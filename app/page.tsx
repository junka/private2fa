"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useI18n } from "@/app/lib/i18n";

export default function Home() {
  const { data: session, status } = useSession();
  const { t } = useI18n();
  const loggedIn = status === "authenticated" && !!session?.user;

  const features = [
    { icon: "🔐", title: t("f1Title"), desc: t("f1Desc") },
    { icon: "📥", title: t("f2Title"), desc: t("f2Desc") },
    { icon: "⏱️", title: t("f3Title"), desc: t("f3Desc") },
  ];

  const trust = [
    ["🛡️", t("t1Title"), t("t1Desc")],
    ["🔓", t("t2Title"), t("t2Desc")],
    ["🚀", t("t3Title"), t("t3Desc")],
  ] as const;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-16 pt-20 text-center">
        <span className="rounded-full border border-indigo-200 bg-indigo-100/60 px-4 py-1 text-sm font-medium text-indigo-700">
          {t("heroBadge")}
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">{t("heroDesc")}</p>
        <div className="mt-8 flex items-center gap-4">
          {loggedIn ? (
            <Link
              href="/otp"
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              {t("goVault")}
            </Link>
          ) : (
            <Link
              href="/signin"
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              {t("getStarted")}
            </Link>
          )}
          <Link
            href="/signin"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
          >
            {t("loginToUse")}
          </Link>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-2xl font-bold text-gray-900">{t("featureTitle")}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 信任点 */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-14 sm:grid-cols-3">
          {trust.map(([icon, title, desc]) => (
            <div key={title} className="text-center">
              <div className="text-2xl">{icon}</div>
              <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA 尾部 */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">{t("ctaTitle")}</h2>
        <p className="mt-2 text-gray-600">{t("ctaDesc")}</p>
        <div className="mt-6">
          {loggedIn ? (
            <Link
              href="/otp"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              {t("ctaBtn")}
            </Link>
          ) : (
            <Link
              href="/signin"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              {t("ctaLogin")}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}