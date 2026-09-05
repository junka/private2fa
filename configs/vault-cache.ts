/**
 * 明文保险箱内存缓存：远端数据库查询延迟高（Supabase 多跳 ~1.5s/次），
 * 解密后的明文按 userId 缓存，写入/删除时主动失效，重复访问秒开。
 * 自托管单机场景下为简单安全的内存 Map（TTL 作为兜底）。
 */

interface VaultCacheEntry {
  vault: unknown; // 已解密明文
  version: number;
  updatedAt: number;
  at: number; // 写入时间戳
}

// 远端库（Supabase 多跳）单次查询 1-5s，TTL 拉长到 10 分钟；写入/删除走 invalidate 主动失效，
// 其它设备推送（/api/sync POST）同样 invalidate，因此长 TTL 不会造成长期脏读。
const TTL_MS = 600_000;
const cache = new Map<string, VaultCacheEntry>();

export function getVaultCache(
  userId: string
): { vault: unknown; meta: { version: number; updatedAt: number } } | null {
  const e = cache.get(userId);
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return { vault: e.vault, meta: { version: e.version, updatedAt: e.updatedAt } };
}

export function setVaultCache(
  userId: string,
  vault: unknown,
  meta: { version: number; updatedAt: number }
): void {
  cache.set(userId, { vault, version: meta.version, updatedAt: meta.updatedAt, at: Date.now() });
}

/** 写入/删除后调用，保证其它端立刻读到最新明文 */
export function invalidateVaultCache(userId: string): void {
  cache.delete(userId);
}