"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/app/lib/i18n";
import SignOutButton from "@/components/signoutbutton";

const SignOutPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  // 未登录访问直接回首页；loading 期间仅渲染空白占位
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  if (status === "loading") return null;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <p className="text-lg text-gray-700">{t("signOutConfirm")}</p>
      <SignOutButton />
    </div>
  );
};

export default SignOutPage;