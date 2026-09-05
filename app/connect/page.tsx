"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/lib/i18n";

/**
 * OAuth 式自动连接中转页（polling 版）。
 * 扩展点击「登录 / 注册账号 →」时打开 /connect?extid=<插件ID>&cid=<随机码>。
 * 1) 未登录 → 302 到 /signin?callbackUrl=/connect?extid=...&cid=...，登录后回到本页；
 * 2) 已登录 → 调 /api/device-token/connect 自动创建令牌并按 cid 暂存，
 *    页面显示「等待插件接收」；扩展后台轮询 /api/device-token/pending 领取后自动绑定。
 * 不再跳回 chrome-extension://（Chrome 拦截 Web 页顶层导航到扩展页）。
 */
export default function ConnectPage() {
  const { t } = useI18n();
  const [msg, setMsg] = useState(t("connecting"));
  const [fallback, setFallback] = useState<{ token: string; name: string } | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const q = new URLSearchParams(window.location.search);
    const extid = q.get("extid") ?? "";
    const cid = q.get("cid") ?? "";
    if (!/^[a-p]{32}$/.test(extid) || !/^[a-f0-9]{16,64}$/.test(cid)) {
      setMsg(t("invalidParams"));
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/device-token/connect?extid=${encodeURIComponent(extid)}&cid=${encodeURIComponent(cid)}`);
        if (res.status === 401) {
          // 未登录：先登录，成功后携带 callbackUrl 回到本页继续连接
          window.location.href = `/signin?callbackUrl=${encodeURIComponent(`/connect?extid=${extid}&cid=${cid}`)}`;
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          setMsg(t("connectFailed", { e: body.error ?? t("readFailed", { n: res.status }) }));
          return;
        }
        setMsg(body.name ? t("connected", { name: body.name as string }) : t("connectedAnonymous"));
        // 备用：若扩展未能自动领取，可手动复制令牌到设置页粘贴
        if (body.token) setFallback({ token: body.token as string, name: (body.name as string) || "device" });
      } catch (e) {
        setMsg(t("connectFailed", { e: e instanceof Error ? e.message : String(e) }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <p className="text-lg">{msg}</p>
      {fallback && (
        <div className="mt-6 max-w-lg">
          <button
            type="button"
            className="mt-4 text-sm text-gray-400 underline"
            onClick={() => setShowFallback((v) => !v)}
          >
            {showFallback ? t("fallbackShow") : t("fallbackToggle")}
          </button>
          {showFallback && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <code className="break-all rounded bg-gray-100 px-3 py-2 text-left text-xs">{fallback.token}</code>
              <button
                type="button"
                className="shrink-0 rounded bg-slate-600 px-3 py-2 text-xs text-white"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fallback.token);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    window.prompt(`${t("copyToken")}:`, fallback.token);
                  }
                }}
              >
                {copied ? t("copiedShort") : t("copyToken")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}