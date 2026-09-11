import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "../configs/rate-limit";

describe("rate-limit（内存滑动窗口）", () => {
  const KEY = "1.2.3.4:/api/sync";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 8, 11, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("窗口内达到上限前全部放行", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(KEY, 5).ok).toBe(true);
    }
  });

  it("超过上限被拒绝并给出重试秒数", () => {
    for (let i = 0; i < 5; i++) rateLimit(KEY, 5);
    const r = rateLimit(KEY, 5);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(r.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("窗口过期后计数重置", () => {
    for (let i = 0; i < 5; i++) rateLimit(KEY, 5);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit(KEY, 5).ok).toBe(true);
  });

  it("不同 key 互不影响", () => {
    for (let i = 0; i < 5; i++) rateLimit("A", 5);
    expect(rateLimit("B", 5).ok).toBe(true);
  });
});