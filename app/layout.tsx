import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { LanguageProvider } from "@/app/lib/i18n";
import { SessionProvider } from "@/components/session-provider";
import { GoogleAnalytics } from '@next/third-parties/google'
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Your OTP 2FA Safebox",
  description: "私人自托管的 TOTP 动态验证码保险箱：OAuth 登录、密钥一键导入、实时验证码展示。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
      <LanguageProvider>
        <SessionProvider>
          <Navbar />
          <main>{children}</main>
        </SessionProvider>
      </LanguageProvider>
      </body>
      <GoogleAnalytics gaId="G-RWD6QBZ35S" />
    </html>
  );
}
