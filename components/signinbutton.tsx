"use client";

import { signIn } from "next-auth/react";
import { useI18n } from "@/app/lib/i18n";

const SignInButton = ({ provider }: { provider: string }) => {
  const { t } = useI18n();
  // 支持 /signin?callbackUrl=... 返回指定页（如扩展自动连接中转页 /connect?extid=...）
  const callbackUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("callbackUrl") || "/"
      : "/";

  const label = provider === "github" ? "GitHub" : "Google";

  return (
    <button
      className="bg-slate-600 px-4 py-2 text-white"
      onClick={() => signIn(provider, { callbackUrl })}
      type="button"
    >
      {t("signInWith", { p: label })}
    </button>
  );
};

export default SignInButton;