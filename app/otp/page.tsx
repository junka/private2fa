import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/configs/nextauth";
import { VaultDisplay } from "@/components/vault-display";

/**
 * OTP 管理页（由原 /profile 合并而来）：
 * 账号登录即可查看/添加/删除验证码；用户信息已移至右上角 banner 下拉。
 */
export default async function OtpPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin?callbackUrl=" + encodeURIComponent("/otp"));
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-8">
      <VaultDisplay />
    </div>
  );
}