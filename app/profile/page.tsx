import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/configs/nextauth";

/** OTP 管理与用户信息现于 /otp 统一提供，/profile 保留旧链接兼容，统一跳转 */
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin?callbackUrl=" + encodeURIComponent("/otp"));
  }

  redirect("/otp");
}