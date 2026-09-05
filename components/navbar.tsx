import { getServerSession } from "next-auth/next";
import { authOptions } from "@/configs/nextauth";
import { NavLinks, type UserInfo } from "./nav-links";

/** Server 端取登录态与用户信息，交给 client 子树渲染链接、语言切换与用户下拉 */
const Navbar = async () => {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  const user: UserInfo | null = u
    ? { name: u.name ?? "", email: u.email ?? "", image: u.image ?? undefined }
    : null;

  return <NavLinks signedIn={!!u} user={user} />;
};

export { Navbar };