#!/usr/bin/env node
/**
 * CDP 截取登录态 /otp 页面（需 Chrome 以 --remote-debugging-port=9222 启动）
 * 输出: release/screenshots/shot-3-otp.png (1280x800)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "release", "screenshots", "shot-3-otp.png");
mkdirSync(dirname(out), { recursive: true });

async function findTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9222/json");
      const list = await res.json();
      const t = list.find((t) => t.type === "page" && t.url.includes("localhost:3000"));
      if (t) return t;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("no localhost:3000 tab found on port 9222");
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seed = 1;
const send = (method, params = {}) => new Promise((res) => {
  const id = seed++;
  const handler = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === id) { ws.removeEventListener("message", handler); res(m); }
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await new Promise((r) => setTimeout(r, 1200)); // 等 TOTP 列表渲染/倒计时首帧
const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log("saved", out);
process.exit(0);