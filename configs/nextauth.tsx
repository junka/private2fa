import { AuthOptions } from 'next-auth'
import { prisma} from "@/configs/prisma";
import { PrismaAdapter } from "@next-auth/prisma-adapter"; 

import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions :AuthOptions = {
  theme: {
    logo: 'https://next-auth.js.org/img/logo/logo-sm.png',
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHubProvider({
      name: "GitHub",
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // GitHub 自 2026-04 起在回调中携带 RFC 9207 的 iss 参数，必须显式声明 issuer
      issuer: "https://github.com/login/oauth",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  pages: {
    signIn: "/signin",
    signOut: "/signout"
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // 把 user.id 放进 token，供 /api/vault 等接口按用户定位保险箱
    async jwt({ token, user }) {
      if (user && user.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      // 优先用回调写入的 uid；兜底 token.sub（NextAuth 始终等于 userId，兼容旧 cookie）
      const id = (token.uid as string | undefined) ?? (token.sub as string | undefined);
      if (session.user && id) (session.user as { id?: string }).id = id;
      return session;
    },
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
}
