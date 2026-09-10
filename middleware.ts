import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/configs/rate-limit";

/**
 * 全局中间件：
 * 1) CORS：扩展（Chrome/Edge/Firefox）不再声明 host_permissions，
 *    MV3 中扩展页面的跨域 fetch 受服务器 CORS 约束，这里放行 /api/*。
 * 2) IP 限频：对同步 / 设备令牌等敏感端点做滑动窗口限频，缓解批量滥用。
 * 鉴权仍由 x-device-token / 会话头在路由内完成，CORS 只负责浏览器侧放行。
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // 扩展请求必经预检：自定义头 x-device-token + content-type: application/json
  "Access-Control-Allow-Headers": "content-type, x-device-token",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// key: 路径前缀 -> 每分钟上限（宽松阈值，防批量脚本滥用，不误伤正常使用）
const LIMITS: Array<{ prefix: string; limit: number }> = [
  { prefix: "/api/sync", limit: 60 },
  { prefix: "/api/device-token", limit: 30 },
  { prefix: "/api/otp", limit: 30 },
];

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 预检请求直接返回，不用进入路由，也不计入限频
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // IP 限频（仅放行路径范围外的直通）
  const ip = clientIp(request);
  const rule = LIMITS.find((r) => path.startsWith(r.prefix));
  if (rule) {
    const r = rateLimit(`${ip}:${rule.prefix}`, rule.limit);
    if (!r.ok) {
      return NextResponse.json(
        { error: "too many requests" },
        {
          status: 429,
          headers: { ...CORS_HEADERS, "retry-after": String(r.retryAfterSec) },
        }
      );
    }
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};