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
    // async jwt({ token , trigger, session }) {
    //   if (trigger === 'update') 
    //     token.name = session.user.name
    //   return token
    // },
    async session({ session, user }) {
      return session;
    },
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
}
