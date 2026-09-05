// 一次性连接授权暂存（纯内存，10 分钟过期）：
// /connect 页在 Web 已登录时创建设备令牌，先按随机 cid 暂存；
// 扩展后台以 cid 轮询领取，取走后立即删除（一次性）。
// 自托管单实例部署下内存版即可；多副本场景需换 Redis 等共享存储。

type Pending = { token: string; name: string; expiresAt: number };

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, Pending>();

export function putPending(cid: string, token: string, name: string): void {
  store.set(cid, { token, name, expiresAt: Date.now() + TTL_MS });
}

export function takePending(cid: string): Pending | null {
  const p = store.get(cid);
  if (!p) return null;
  store.delete(cid); // 一次性：领取即删除，防止令牌再次被取
  if (p.expiresAt < Date.now()) return null;
  return p;
}