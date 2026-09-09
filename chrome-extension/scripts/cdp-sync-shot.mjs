#!/usr/bin/env node
/** 对已解锁 options 页滚动到指定区块并截图：node cdp-sync-shot.mjs */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EXT_ID = "congbelljckfecpfjopmgfenalcjbpfi";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "release", "screenshots", "shot-options-sync.png");
mkdirSync(dirname(out), { recursive: true });

const list = await fetch("http://127.0.0.1:9222/json").then((r) => r.json());
const t = list.find((x) => x.type === "page" && x.url === `chrome-extension://${EXT_ID}/options.html`);
if (!t) throw new Error("options target not found");
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seed = 1;
const send = (method, params = {}) => new Promise((res) => {
  const id = seed++;
  const h = (ev) => { const m = JSON.parse(ev.data); if (m.id === id) { ws.removeEventListener("message", h); res(m.result ?? m); } };
  ws.addEventListener("message", h);
  ws.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");
const r = await send("Runtime.evaluate", {
  expression: `(() => {
    const el = [...document.querySelectorAll('h2,h3,div,section')].find(e => e.textContent.trim() === '同步与云端');
    if (el) el.scrollIntoView({ block: 'start' });
    return !!el;
  })()`,
  returnByValue: true,
});
console.log("scrolled to sync section:", r?.result?.value);
await new Promise((r2) => setTimeout(r2, 600));
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log("saved", out);
process.exit(0);