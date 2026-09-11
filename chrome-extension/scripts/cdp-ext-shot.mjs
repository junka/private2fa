#!/usr/bin/env node
/**
 * CDP 截取扩展界面（需 Chrome 以 --remote-debugging-port=9222 启动并加载扩展）：
 *   node cdp-ext-shot.mjs options  -> release/screenshots/options-list.png
 *   node cdp-ext-shot.mjs popup    -> release/screenshots/popup.png
 * 从已有标签中按 URL 关键字（options.html / popup.html）匹配截图。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EXT_ID = "congbelljckfecpfjopmgfenalcjbpfi";
const which = process.argv[2] || "options";
const CDP_PORT = process.env.CDP_PORT ?? 9222;
const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "release", "screenshots",
  which === "popup" ? "shot-popup.png" : which === "options-sync" ? "shot-options-sync.png" : "shot-options-list.png"
);
mkdirSync(dirname(out), { recursive: true });

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const list = await res.json();
      const t = list.find((t) => t.type === "page" && t.url.includes(`${EXT_ID}/${which}.html`));
      if (t) return t;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`no ${which}.html tab found (is the extension loaded?)`);
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
await new Promise((r) => setTimeout(r, 1500));
const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log("saved", out);
process.exit(0);