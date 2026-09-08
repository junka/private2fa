// 一次性连接授权暂存（纯内存，10 分钟过期）：
// /connect 页在 Web 已登录时创建设备令牌，先按随机 cid 暂存；
// 扩展后台以 cid 轮询领取，取走后立即删除（一次性）。
// 自托管单实例部署下内存版即可；多副本场景需换 Redis 等共享存储。

type Pending = { token: string; name: string; expiresAt: number };

const TTL_MS = 10 * 60 * 1000;
// 单设备并发 pending 上限：正常连接流程每次仅 1 条；上限防止同一账号循环拉高内存
export const MAX_PENDING_PER_DEVICE = 5;
const MAX_STORE_SIZE = 10_000;

const store = new Map<string, Pending>();

/** 惰性清理过期条目，避免环触发连接时内存被过期记录灌满 */
function sweep(now: number): void {
  if (store.size < MAX_STORE_SIZE) return;
  store.forEach((v, k) => {
    if (v.expiresAt < now) store.delete(k);
  });
}

export function pendingCountForDevice(token: string): number {
  let n = 0;
  store.forEach((p) => {
    if (p.token === token) n++;
  });
  return n;
}

export function putPending(cid: string, token: string, name: string): boolean {
  sweep(Date.now());
  if (pendingCountForDevice(token) >= MAX_PENDING_PER_DEVICE) return false;
  store.set(cid, { token, name, expiresAt: Date.now() + TTL_MS });
  return true;
}

export function takePending(cid: string): Pending | null {
  const p = store.get(cid);
  if (!p) return null;
  store.delete(cid); // 一次性：领取即删除，防止令牌再次被取
  if (p.expiresAt < Date.now()) return null;
  return p;
}