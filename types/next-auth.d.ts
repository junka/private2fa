import "next-auth";

/** 扩展 next-auth Session：确保 session.user.id 可用（JWT session 中取 token.sub） */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}