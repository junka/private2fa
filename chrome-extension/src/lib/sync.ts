import type { Settings, VaultMeta, VaultData } from "./types";

/** L3 自建后端同步（账号密钥云加密 + version 冲突仲裁）。带设备令牌 Bearer 鉴权。 */

export interface SyncPullResult {
  ok: boolean;
  notFound?: boolean; // 云端还没有备份
  legacy?: boolean; // 云端仍是旧版 v1 信封（服务端不可解密），需本地重新推送迁移
  vault?: VaultData | null; // 服务端解密后的明文（Web 与插件同源）
  meta?: VaultMeta | null;
  error?: string;
}

export interface SyncPushResult {
  ok: boolean;
  conflict?: boolean; // 云端 version 更新，需先拉取
  serverMeta?: VaultMeta | null;
  error?: string;
}

/** 网页端遗留 OTP 明文（迁移用；secret 为 hex 字节串，需转 base32） */
export interface LegacyOtp {
  label: string;
  secret: string;
  algorithm: string;
  issuer: string;
  period: number;
  digits: number;
}

export async function fetchLegacyOtps(
  settings: Settings
): Promise<{ ok: boolean; otps: LegacyOtp[]; error?: string }> {
  try {
    const res = await request(settings, "/api/otp/legacy", { method: "GET" });
    if (!res.ok) return { ok: false, otps: [], error: `服务器错误 ${res.status}` };
    const body = (await res.json()) as { otps?: LegacyOtp[] };
    return { ok: true, otps: body.otps ?? [] };
  } catch (e) {
    return { ok: false, otps: [], error: e instanceof Error ? e.message : "网络错误" };
  }
}

async function request(
  settings: Settings,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (settings.deviceToken) {
    headers["x-device-token"] = settings.deviceToken;
  }
  return fetch(`${settings.serverUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
}

export async function pushToCloud(
  settings: Settings,
  vault: VaultData,
  meta: VaultMeta
): Promise<SyncPushResult> {
  try {
    const res = await request(settings, "/api/sync", {
      method: "POST",
      body: JSON.stringify({ vault, meta, deviceName: "Chrome 扩展" }),
    });
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as { meta?: VaultMeta };
      return { ok: false, conflict: true, serverMeta: body.meta ?? null };
    }
    if (!res.ok) return { ok: false, error: `服务器错误 ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}

export async function pullFromCloud(
  settings: Settings
): Promise<SyncPullResult> {
  try {
    const res = await request(settings, "/api/sync", { method: "GET" });
    if (res.status === 404) return { ok: true, notFound: true };
    if (!res.ok) return { ok: false, error: `服务器错误 ${res.status}` };
    const body = (await res.json()) as {
      legacy?: boolean;
      vault: VaultData;
      meta: VaultMeta;
    };
    if (body.legacy) return { ok: true, legacy: true, meta: body.meta ?? null };
    return { ok: true, vault: body.vault, meta: body.meta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}

export async function clearCloud(settings: Settings): Promise<boolean> {
  try {
    const res = await request(settings, "/api/sync", { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/** 校验设备令牌是否有效（用于 options 页粘贴 token 后验证） */
export async function verifyDeviceToken(
  settings: Settings
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await request(settings, "/api/device-token/verify");
    if (res.ok) {
      const body = (await res.json()) as { name?: string };
      return { ok: true, name: body.name };
    }
    return { ok: false, error: `令牌无效 (${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}