"use client";

import { useI18n } from "@/app/lib/i18n";
import SignInButton from "@/components/signinbutton";

/** 登录页卡片：居中布局、品牌头图 + 双 OAuth 按钮（随站点语言切换） */
export default function SignInCard() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[75vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl text-white shadow-md">
            🔐
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("signInTitle")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            {t("signInSub")}
          </p>
        </div>
        <div className="space-y-3">
          <SignInButton provider="github" />
          <SignInButton provider="google" />
        </div>
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-neutral-500">
          {t("signInAgree")}{" "}
          <a href="/privacy" className="underline hover:text-gray-600 dark:hover:text-neutral-300">
            {t("privacyTitle")}
          </a>
        </p>
      </div>
    </div>
  );
}