"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type Lang } from "@/app/lib/i18n";

/** Banner 链接 + 语言切换 + 用户下拉（session 由 server 端 Navbar 传入） */

const LANGS: { code: Lang; label: string }[] = [
  { code: "zh", label: "中" },
  { code: "en", label: "EN" },
];

export interface UserInfo {
  name: string;
  email: string;
  image?: string;
}

export function NavLinks({ signedIn, user }: { signedIn: boolean; user: UserInfo | null }) {
  const { t, lang, setLang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 路由切换时收起（点退出登录等导航链接）
  useEffect(() => setMenuOpen(false), [pathname]);

  // 点击下拉以外的区域时收起
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  return (
    <nav className="bg-indigo-600 p-4">
      <div className="mx-auto flex max-w-5xl items-center gap-x-4">
        <Link href="/" className="text-white hover:underline">
          {t("home")}
        </Link>

        {signedIn && (
          <Link href="/otp" className="text-white hover:underline">
            {t("otp")}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* 语言切换 */}
          <div className="flex items-center gap-0.5 rounded-md bg-white/10 p-0.5">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`rounded px-2 py-0.5 text-xs transition ${
                  lang === code
                    ? "bg-white font-medium text-indigo-700"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {signedIn && user ? (
            // 用户名下拉：头像 / 邮箱 / 退出登录（点击外部或路由切换时收起）
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 text-white"
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt=""
                    className="h-7 w-7 rounded-full bg-white/20 object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-medium">
                    {(user.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="max-w-40 truncate text-sm">{user.name}</span>
                <span className={`text-xs text-white/70 transition-transform ${menuOpen ? "rotate-180" : ""}`}>▾</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                  {user.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="mb-2 h-16 w-16 rounded-full object-cover" />
                  )}
                  <p className="font-medium text-gray-900">{user.name}</p>
                  {user.email && (
                    <p className="mt-0.5 break-all text-sm text-gray-500">{user.email}</p>
                  )}
                  <Link
                    href="/signout"
                    onClick={() => setMenuOpen(false)}
                    className="mt-3 block rounded-md bg-indigo-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    {t("signOut")}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/signin"
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            >
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}