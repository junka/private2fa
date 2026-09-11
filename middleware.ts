import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/configs/rate-limit";

/**
 * 全局中间件：
 * 1) CORS：扩展（Chrome/Edge/Firefox）不再声明 host_permissions，
 *    MV3 中扩展页面的跨域 fetch 受服务器 CORS 约束，这里放行 /api/*。
 * 2) IP 限频：对同步 / 设备令牌等敏感端点做滑动窗口限频，缓解批量滥用。
 * 3) 安全头 + CSP（nonce）：覆盖页面与 API，防 XSS / 点击劫持 / MIME 嗅探。
 * 鉴权仍由 x-device-token / 会话头在路由内完成，CORS 只负责浏览器侧放行。
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // 扩展请求必经预检：自定义头 x-device-token + content-type: application/json
  "Access-Control-Allow-Headers": "content-type, x-device-token",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// 非 CORS 安全头：所有页面 / API 响应统一下发
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

// key: 路径前缀 -> 每分钟上限（宽松阈值，防批量脚本滥用，不误伤正常使用）
const LIMITS: Array<{ prefix: string; limit: number }> = [
  { prefix: "/api/sync", limit: 60 },
  { prefix: "/api/device-token", limit: 30 },
  { prefix: "/api/otp", limit: 30 },
];

/**
 * 客户端真实 IP：Cloudflare 代理时取 CF-Connecting-IP（CF 重写 XFF，
 * 不回传则第一跳恒为 CF 边缘 IP，限频会误伤所有共享用户）；
 * 直连 Vercel 时回退 X-Forwarded-For。
 */
function clientIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

function base64Of(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** per-请求 CSP。开发模式放宽（HMR 需 eval），生产严格 nonce 校验。
 * 第三方白名单仅 @next/third-parties 的 Google Analytics（layout.tsx 登记，
 * 与隐私政策披露一致）；其余一律 'self'。 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://www.googletagmanager.com`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind 内联样式 / 极少第三方内联 style
    "style-src 'self' 'unsafe-inline'",
    // GA4 收集 / 受众同步 beacon 域名（web + 回退端点）
    "img-src 'self' data: blob: https://www.google-analytics.com https://www.google.com.hk",
    "font-src 'self'",
    // GA4 上报端点（gtag 运行的 collect 请求，含 locale 回退域）
    "connect-src 'self' https://www.google-analytics.com https://stats.g.doubleclick.net https://analytics.google.com https://www.google.com https://www.google.com.hk",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Web 无 iframe / 弹窗登录（OAuth 整页跳转），完全禁止嵌套
    "frame-ancestors 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 预检请求直接返回，不用进入路由，也不计入限频
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // IP 限频（仅命中规则前缀的端点计数）
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

  // nonce：Next 会为内联脚本 / strict-dynamic 引用自动附加该值（App Router 支持）
  const nonce = base64Of(crypto.getRandomValues(new Uint8Array(16)));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-middleware-request-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  return res;
}

export const config = {
  // 覆盖页面 + API；静态资源（_next/static 等）跳过中间件减少开销
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|css|js|map|woff2?)$).*)",
  ],
};