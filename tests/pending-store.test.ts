import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PENDING_PER_DEVICE,
  pendingCountForDevice,
  putPending,
  takePending,
} from "../app/api/device-token/pending-store";

describe("pending-store（一次性连接授权暂存）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 8, 11, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("存入后可被一次性领取，领取后不可再取", () => {
    expect(putPending("cid1", "tok-a", "user")).toBe(true);
    const p = takePending("cid1");
    expect(p?.token).toBe("tok-a");
    expect(p?.name).toBe("user");
    expect(takePending("cid1")).toBeNull();
  });

  it("同一设备超过上限后拒绝继续暂存", () => {
    const cids = Array.from(
      { length: MAX_PENDING_PER_DEVICE },
      (_, i) => `cid-${i}`
    );
    for (const cid of cids) {
      expect(putPending(cid, "tok-b", "user")).toBe(true);
    }
    expect(pendingCountForDevice("tok-b")).toBe(MAX_PENDING_PER_DEVICE);
    expect(putPending("cid-overflow", "tok-b", "user")).toBe(false);
  });

  it("不同设备 token 互不影响", () => {
    expect(putPending("c1", "tok-c1", "u")).toBe(true);
    expect(putPending("c2", "tok-c2", "u")).toBe(true);
    expect(pendingCountForDevice("tok-c1")).toBe(1);
    expect(pendingCountForDevice("tok-c2")).toBe(1);
  });

  it("过期条目领取时被拒绝", () => {
    putPending("cid-old", "tok-c", "user");
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(takePending("cid-old")).toBeNull();
  });

  it("过期前正常领取，过期后领取不可", () => {
    putPending("cid-t", "tok-d", "user");
    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(takePending("cid-t")?.token).toBe("tok-d");
  });
});