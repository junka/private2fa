import jsQR from "jsqr";
import browser from "webextension-polyfill";
import type { VaultAccount } from "./types";
import { parseOtpauthUrl } from "./import";

/** 截图/图片识别导入：多尺寸 jsQR 解码 + otpauth:// 提取 */

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = dataUrl;
  });
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片解析失败"));
    };
    img.src = url;
  });
}

/** 截取当前可见标签页（requires activeTab 权限；popup 打开即已授予） */
export async function captureCurrentTab(): Promise<string> {
  try {
    const dataUrl = await browser.tabs.captureVisibleTab(browser.windows.WINDOW_ID_CURRENT, {
      format: "png",
    });
    return dataUrl;
  } catch (err) {
    throw new Error(err instanceof Error && err.message ? err.message : "截图失败");
  }
}

/**
 * 多尺寸扫描：大图整幅解码命中率低，按长边等比缩放多轮尝试。
 * 返回解码出的第一段二维码文本（多为 JSON / 纯 URL）。
 */
export async function scanQrFromImage(img: HTMLImageElement): Promise<string | null> {
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  if (!W || !H) return null;

  const MAX_LONG = 2048;
  const sizes = [
    Math.min(MAX_LONG, Math.max(W, H)), // 原图（限 2048）
    1024, 768, 640, 512, 420, 320, 260,
  ].filter((s, i, arr) => arr.indexOf(s) === i); // 去重

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  for (const s of sizes) {
    const ratio = s / Math.max(W, H);
    const cw = Math.max(1, Math.round(W * ratio));
    const ch = Math.max(1, Math.round(H * ratio));
    canvas.width = cw;
    canvas.height = ch;
    ctx.drawImage(img, 0, 0, cw, ch);
    const d = ctx.getImageData(0, 0, cw, ch);
    const qr = jsQR(d.data, d.width, d.height);
    if (qr && qr.data) return qr.data;
  }
  return null;
}

/** 从任意文本中提取 otpauth:// URL 并解析为账户 */
export function extractOtpauth(text: string): VaultAccount[] {
  const matches = text.match(/otpauth:\/\/[^\s"'<>]+/g) ?? [];
  const out: VaultAccount[] = [];
  for (const m of matches) {
    try {
      out.push(parseOtpauthUrl(m));
    } catch {
      /* 跳过无法解析的片段 */
    }
  }
  return out;
}

/** 从剪贴板读取第一张图片（需要 clipboardRead 权限/用户手势） */
export async function readClipboardImage(): Promise<Blob | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) return item.getType(type);
    }
    return null;
  } catch {
    return null; // 权限被拒等
  }
}