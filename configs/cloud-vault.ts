import { prisma } from "./prisma";

/**
 * 云端保险箱信封（账号密钥加密，v2）：
 * 密钥由服务端生成并持有，Web 登录 / 插件设备令牌均可解密 —— 云端是"账号登录控制"的信任边界。
 * 与旧版（v1 用户主密码 E2EE 信封）不同，本服务端拥有解密能力。
 */

export interface CloudEnvelope {
  v: 2;
  cipher: { algo: "AES-GCM"; iv: string; ct: string };
}

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromB64(b: string): Uint8Array {
  return new Uint8Array(Buffer.from(b, "base64"));
}

// 账号密钥生成后不变：内存缓存避免每次加解密都查一次远端 user 表（省 1-2 次 1-5s 慢查询）
const KEY_CACHE_TTL = 30 * 60_000;
const keyCache = new Map<string, { key: Uint8Array; at: number }>();

async function accountKey(userId: string): Promise<Uint8Array> {
  const hit = keyCache.get(userId);
  if (hit && Date.now() - hit.at < KEY_CACHE_TTL) return hit.key;
  let row = await prisma.user.findUnique({ where: { id: userId }, select: { cloudKey: true } });
  if (!row) throw new Error("user not found");
  let key: Uint8Array;
  if (!row.cloudKey) {
    key = crypto.getRandomValues(new Uint8Array(32));
    await prisma.user.update({ where: { id: userId }, data: { cloudKey: b64(key) } });
  } else {
    key = fromB64(row.cloudKey);
  }
  keyCache.set(userId, { key, at: Date.now() });
  return key;
}

async function cipherKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptCloud(userId: string, plain: object): Promise<CloudEnvelope> {
  const key = await cipherKey(await accountKey(userId));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(plain));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return { v: 2, cipher: { algo: "AES-GCM", iv: b64(iv), ct: b64(new Uint8Array(ct)) } };
}

export async function decryptCloud(userId: string, envelope: CloudEnvelope): Promise<unknown> {
  if (envelope?.v !== 2) throw new Error("云端信封版本不支持（旧主密码 E2EE 数据？）");
  const key = await cipherKey(await accountKey(userId));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.cipher.iv) },
    key,
    fromB64(envelope.cipher.ct)
  );
  return JSON.parse(new TextDecoder().decode(pt));
}

/** 旧版信封（v1 用户主密码 E2EE）：服务端无主密码不可解密，需客户端重新推送明文迁移 */
export function isLegacyCloudEnvelope(env: unknown): boolean {
  return (
    (env as { v?: unknown })?.v === 1 &&
    ["kdf", "cipher"].every((k) => k in (env as object))
  );
}

/** 简单结构校验：vault 明文必备字段 */
export function isCloudVault(v: unknown): v is {
  version: number;
  updatedAt: number;
  accounts: unknown[];
  groups: unknown[];
} {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { version?: unknown }).version === "number" &&
    typeof (v as { updatedAt?: unknown }).updatedAt === "number" &&
    Array.isArray((v as { accounts?: unknown }).accounts) &&
    Array.isArray((v as { groups?: unknown }).groups)
  );
}