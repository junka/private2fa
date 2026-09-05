"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/** next-auth/react 源码无 "use client" 标记，包一层保证在 RSC layout 中作为 client 边界渲染 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}