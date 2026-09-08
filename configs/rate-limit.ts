/**
 * 内存滑动窗口限频（Edge middleware 可用，无外部依赖）。
 * 注意：部署为多实例/Serverless 时各实例独立计数，仅能显著降低滥用速度；
 * 如需严格全局限频，应换成共享存储（Upstash/Redis）实现。
 */

const WINDOW_MS = 60_000;
const MAX_BUCKETS = 20_000;

const buckets = new Map<string, { count: number; at: number }>();

/** 清理过期桶，防止 key 无限增长（IP/路径组合有限，水位可控） */
function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  buckets.forEach((v, k) => {
    if (now - v.at >= WINDOW_MS) buckets.delete(k);
  });
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/** 固定窗口限频：key 维度（如 IP+路径），窗口 60s，超过 limit 拒绝 */
export function rateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now - b.at >= WINDOW_MS) {
    buckets.set(key, { count: 1, at: now });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - b.at)) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0 };
}