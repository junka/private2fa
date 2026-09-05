import { NextRequest } from "next/server";
import { prisma } from "@/configs/prisma";

/** token→userId 内存缓存：远端库查询延迟高，设备令牌注册后极少变更，TTL 兜底 */
const TTL_MS = 60_000;
const tokenCache = new Map<string, { userId: string; at: number }>();

/** x-device-token → userId；未注册返回 null（/api/sync、/api/otp/legacy 共用） */
export async function deviceUserId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("x-device-token");
  if (!token) return null;
  const hit = tokenCache.get(token);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.userId;
  try {
    const d = await prisma.deviceToken.findUnique({ where: { token } });
    const userId = d?.userId ?? null;
    if (userId) tokenCache.set(token, { userId, at: Date.now() });
    return userId;
  } catch (err) {
    console.error("[device-auth] resolve device failed:", err);
    return null;
  }
}

/** 令牌失效/重新连接时清理缓存（connect 流程调用） */
export function forgetDeviceToken(token: string): void {
  tokenCache.delete(token);
}