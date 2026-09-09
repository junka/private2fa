import browser from "webextension-polyfill";
import type { Envelope, Settings, VaultMeta } from "./types";

/** L1 本地主库（browser.storage.local）+ L2 Chrome 官方通道（browser.storage.sync，分块镜像） */

// ---- 键名 ----
export const K = {
  ENV: "v_env2", // Envelope 密文（L1）
  META: "v_meta2", // VaultMeta 明文（L1，供跨层比较）
  SETTINGS: "v_settings2",
  MASTER_HASH: "v_master_hash2", // 主密码指纹（解锁校验用，非口令）
};

const L2_PREFIX = "v:";
const L2_CHUNK_SIZE = 6000; // < 8192 配额余量

// ---------------- L1（主库，数据权威） ----------------

export async function loadEnvelopeLocal(): Promise<Envelope | null> {
  const { [K.ENV]: env } = await browser.storage.local.get(K.ENV);
  return env ?? null;
}

export async function loadMetaLocal(): Promise<VaultMeta | null> {
  const { [K.META]: meta } = await browser.storage.local.get(K.META);
  return meta ?? null;
}

export async function saveLocal(
  envelope: Envelope,
  meta: VaultMeta
): Promise<void> {
  await browser.storage.local.set({ [K.ENV]: envelope, [K.META]: meta });
}

export async function loadSettings(): Promise<Settings> {
  const defaults: Settings = {
    serverUrl: "https://nextjs-junkas-projects.vercel.app",
    autoLockMinutes: 10,
    syncChrome: false,
    syncCloud: false,
    deviceToken: null,
    deviceTokenName: null,
  };
  const { [K.SETTINGS]: s } = await browser.storage.local.get(K.SETTINGS);
  return { ...defaults, ...(s ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await browser.storage.local.set({ [K.SETTINGS]: s });
}

export async function setMasterHash(hash: string): Promise<void> {
  await browser.storage.local.set({ [K.MASTER_HASH]: hash });
}

export async function getMasterHash(): Promise<string | null> {
  const { [K.MASTER_HASH]: h } = await browser.storage.local.get(K.MASTER_HASH);
  return h ?? null;
}

// ---------------- L2（Chrome 官方通道：被动镜像，分块） ----------------

function chunkString(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

/**
 * 把加密信封分块镜像到 browser.storage.sync。
 * 失败（配额/同步停用）返回 false，由调用方决定降级提示；不影响 L1。
 */
export async function mirrorToChromeSync(
  envelope: Envelope,
  meta: VaultMeta
): Promise<boolean> {
  try {
    const json = JSON.stringify(envelope);
    const chunks = chunkString(json, L2_CHUNK_SIZE);
    const obj: Record<string, string> = {
      [`${L2_PREFIX}@meta`]: JSON.stringify({ n: chunks.length, ...meta }),
    };
    chunks.forEach((c, i) => (obj[`${L2_PREFIX}@c${i}`] = c));
    await browser.storage.sync.set(obj);
    return true;
  } catch (e) {
    console.warn("[storage] L2 mirror failed:", e);
    return false;
  }
}

export async function readChromeSync(): Promise<{
  envelope: Envelope | null;
  meta: VaultMeta | null;
}> {
  const all = await browser.storage.sync.get(null);
  const metaRaw = all[`${L2_PREFIX}@meta`] as string | undefined;
  if (!metaRaw) return { envelope: null, meta: null };
  const m = JSON.parse(metaRaw) as VaultMeta & { n: number };
  let json = "";
  for (let i = 0; i < m.n; i++) {
    const c = all[`${L2_PREFIX}@c${i}`] as string | undefined;
    if (!c) return { envelope: null, meta: null }; // 分块不完整，视为损坏
    json += c;
  }
  try {
    const envelope = JSON.parse(json) as Envelope;
    return { envelope, meta: { version: m.version, updatedAt: m.updatedAt } };
  } catch {
    return { envelope: null, meta: null };
  }
}

export async function clearChromeSync(): Promise<void> {
  const all = await browser.storage.sync.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(L2_PREFIX));
  if (keys.length) await browser.storage.sync.remove(keys);
}

/** 监听远端（其他设备/浏览器）对 L2 的更新；返回当前 L2 数据供上层仲裁 */
export function onChromeSyncChanged(
  cb: (data: { envelope: Envelope | null; meta: VaultMeta | null }) => void
): void {
  browser.storage.onChanged.addListener((changes: any, area: any) => {
    if (area !== "sync") return;
    if (changes[`${L2_PREFIX}@meta`] || Object.keys(changes).some((k) => k.startsWith(L2_PREFIX))) {
      void readChromeSync().then(cb);
    }
  });
}