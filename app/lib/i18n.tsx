"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * 轻量 i18n：Context + localStorage 持久化，支持 zh / en。
 * 文案按 key 集中管理，t(key, params) 支持 {name} 占位替换。
 */

export type Lang = "zh" | "en";

const dicts: Record<Lang, Record<string, string>> = {
  zh: {
    // ===== banner =====
    home: "首页",
    otp: "OTP",
    signIn: "登录",
    signOut: "退出登录",

    // ===== 首页 =====
    heroBadge: "私人 · 开源 · 自托管",
    heroTitle: "Your OTP 2FA Safebox",
    heroDesc:
      "一个只属于你的动态验证码保险箱。集中管理所有 TOTP 密钥，随时查看实时验证码——不依赖任何第三方验证器，数据完全握在自己手中。",
    goVault: "前往我的保险箱 →",
    getStarted: "立即开始",
    loginToUse: "登录后使用账户",
    featureTitle: "为什么选择它",
    f1Title: "OAuth 登录即可用",
    f1Desc: "支持 GitHub / Google 账号一键登录，无需注册流程，开箱即用。",
    f2Title: "扫描即导入",
    f2Desc: "粘贴 otpauth:// URL 即可添加密钥，自动解析 issuer、算法、周期等参数。",
    f3Title: "实时动态码 + 倒计时",
    f3Desc: "个人主页实时展示 6 位验证码，进度条提示刷新时机，不再手忙脚乱看时间。",
    t1Title: "加密存储",
    t1Desc: "密钥以标准格式安全存放于你的数据库中，不做任何云端中转。",
    t2Title: "开放透明",
    t2Desc: "基于 Next.js + Prisma 构建，代码完全开源，可审计、可自部署。",
    t3Title: "轻量快捷",
    t3Desc: "无需安装客户端，浏览器打开即用，支持 GitHub / Google 双通道登录。",
    ctaTitle: "现在就开始管理你的 2FA",
    ctaDesc: "登录后导入密钥，首页即可看到实时动态验证码。",
    ctaBtn: "导入我的第一个密钥",
    ctaLogin: "登录开始使用",

    // ===== OTP 页 / 保险箱 =====
    otpTitle: "OTP 保险箱",
    addTitle: "添加密钥",
    addDesc: "粘贴 otpauth:// 密钥 URL，支持多行批量（每行一个）。例如：",
    import: "导入",
    saving: "保存中…",
    loadingCodes: "加载验证码中…",
    noData: "云端暂无 OTP 数据，可在上方添加第一个密钥。",
    noKeys: "保险箱中没有 OTP 密钥，请在上方添加。",
    listMeta: "云端 OTP · 共 {n} 个（{g} 个分组）· v{v}",
    refresh: "刷新",
    copy: "复制",
    delete: "删除",
    deleteConfirm: "确认删除该密钥？",
    copied: "已复制 {name} 的验证码",
    copyFailed: "复制失败，请手动复制",
    savedMsg: "已保存到云端，可在 Chrome 插件中点「立即同步」拉取",
    saveFailed: "保存失败（HTTP {n}）",
    conflict: "云端刚被其它设备更新（v{n}），请点击刷新后重试",
    parseFailed: "解析失败：以下行不是有效的 otpauth:// URL（共 {n} 行）",
    inputRequired: "请输入 otpauth:// 开头的密钥 URL",
    imported: "已导入 {n} 条；{m} 行无法解析已跳过",
    auth401: "登录状态读取失败（401），请刷新页面或重新登录后重试",
    legacy:
      "云端存有旧版加密数据（旧主密码格式），请在 Chrome 插件「OTP Safebox」中解锁后点击「立即同步」完成迁移，再刷新本页",
    networkErr: "网络异常，无法读取云端数据",
    readFailed: "读取失败（HTTP {n}）",
    unnamed: "未命名",

    // ===== 登录 / 退出 =====
    signInWith: "使用 {p} 登录",
    signOutConfirm: "确定要退出登录吗？",

    // ===== 扩展连接页 /connect =====
    connecting: "正在连接…",
    invalidParams: "连接参数缺失或不合法，请从插件弹窗内的「登录 / 注册账号」重新发起连接。",
    connectFailed: "连接失败：{e}",
    connected: "✅ 已连接账号：{name}。请返回插件，令牌将自动绑定。",
    connectedAnonymous: "✅ 已连接，请返回插件，令牌将自动绑定。",
    fallbackToggle: "插件未自动接收？手动复制令牌",
    fallbackShow: "收起令牌",
    copyToken: "复制令牌",
    copiedShort: "已复制",
  },
  en: {
    // ===== banner =====
    home: "Home",
    otp: "OTP",
    signIn: "Sign In",
    signOut: "Sign Out",

    // ===== Home =====
    heroBadge: "Private · Open Source · Self-hosted",
    heroTitle: "Your OTP 2FA Safebox",
    heroDesc:
      "A verification-code vault that belongs to you. Manage all TOTP keys in one place and view live codes anytime — no third-party authenticator, your data stays fully in your hands.",
    goVault: "Open my safebox →",
    getStarted: "Get started",
    loginToUse: "Sign in to use your account",
    featureTitle: "Why choose it",
    f1Title: "Login with OAuth",
    f1Desc: "One-click sign-in with GitHub / Google. No registration required, ready out of the box.",
    f2Title: "Import in seconds",
    f2Desc: "Paste an otpauth:// URL to add a key; issuer, algorithm, period and more are parsed automatically.",
    f3Title: "Live codes + countdown",
    f3Desc: "6-digit codes with a countdown bar on your profile page — never scramble for the right time.",
    t1Title: "Encrypted storage",
    t1Desc: "Keys are stored in your database in standard format, with no cloud relay in between.",
    t2Title: "Open & transparent",
    t2Desc: "Built with Next.js + Prisma, fully open source, auditable and self-deployable.",
    t3Title: "Light & fast",
    t3Desc: "No client to install; works right in the browser with GitHub / Google sign-in.",
    ctaTitle: "Start managing your 2FA now",
    ctaDesc: "Sign in and import a key — see live codes on your home page right away.",
    ctaBtn: "Import my first key",
    ctaLogin: "Sign in to start",

    // ===== OTP page / vault =====
    otpTitle: "OTP Safebox",
    addTitle: "Add a key",
    addDesc: "Paste an otpauth:// key URL, one per line for batch import. E.g.:",
    import: "Import",
    saving: "Saving…",
    loadingCodes: "Loading codes…",
    noData: "No OTP data in the cloud yet. Add your first key above.",
    noKeys: "No keys in the safebox. Add one above.",
    listMeta: "Cloud OTP · {n} keys ({g} groups) · v{v}",
    refresh: "Refresh",
    copy: "Copy",
    delete: "Delete",
    deleteConfirm: "Delete this key?",
    copied: "Copied {name}'s code",
    copyFailed: "Copy failed, please copy manually",
    savedMsg: "Saved to the cloud. Tap “Sync now” in the Chrome extension to pull it.",
    saveFailed: "Save failed (HTTP {n})",
    conflict: "Updated by another device just now (v{n}). Please refresh and retry.",
    parseFailed: "Parse failed: these lines are not valid otpauth:// URLs ({n} lines)",
    inputRequired: "Enter an otpauth:// key URL",
    imported: "Imported {n} keys; skipped {m} unparsable lines",
    auth401: "Session check failed (401). Please refresh the page or sign in again.",
    legacy:
      "Legacy encrypted data (old master-password format) found in the cloud. Unlock “OTP Safebox” in the Chrome extension, tap “Sync now” to migrate, then refresh this page.",
    networkErr: "Network error, failed to load cloud data",
    readFailed: "Load failed (HTTP {n})",
    unnamed: "Untitled",

    // ===== Sign in / out =====
    signInWith: "Sign in with {p}",
    signOutConfirm: "Are you sure you want to sign out?",

    // ===== /connect =====
    connecting: "Connecting…",
    invalidParams:
      "Missing or invalid connection parameters. Please start again from “Sign in / Register →” in the extension popup.",
    connectFailed: "Connection failed: {e}",
    connected: "✅ Connected as {name}. Return to the extension and the token will be bound automatically.",
    connectedAnonymous: "✅ Connected. Return to the extension and the token will be bound automatically.",
    fallbackToggle: "Not received automatically? Copy the token manually",
    fallbackShow: "Hide token",
    copyToken: "Copy token",
    copiedShort: "Copied",
  },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** 取当前语言文案；key 缺失时原样返回。{name} 占位用 params 替换 */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    // 首次挂载：恢复本地语言偏好，并同步 <html lang>
    const saved = localStorage.getItem(STORAGE_KEY);
    const next: Lang = saved === "en" || saved === "zh" ? saved : "zh";
    setLangState(next);
    document.documentElement.lang = next;
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  };

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => {
      let s = dicts[lang][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.replaceAll(`{${k}}`, String(v));
        }
      }
      return s;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}