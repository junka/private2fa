"use client";

import { signOut } from "next-auth/react";
import { useI18n } from "@/app/lib/i18n";

const SignOutButton = () => {
  const { t } = useI18n();
  return (
    <button
      className="bg-slate-600 px-4 py-2 text-white"
      onClick={() => signOut({ callbackUrl: "/" })}
      type="button"
    >
      {t("signOut")}
    </button>
  );
};

export default SignOutButton;