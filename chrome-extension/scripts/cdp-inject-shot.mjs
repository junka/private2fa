#!/usr/bin/env node
/**
 * 向扩展注入演示状态 → 解锁 → 截图（真实 UI + 可控演示数据）
 *   node cdp-inject-shot.mjs options list  -> shot-options-list.png
 *   node cdp-inject-shot.mjs popup  main   -> shot-popup.png
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EXT_ID = "congbelljckfecpfjopmgfenalcjbpfi";
const which = process.argv[2] || "options";
const outName = which === "popup" ? "shot-popup.png" : "shot-options-list.png";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "release", "screenshots", outName);
mkdirSync(dirname(out), { recursive: true });

const demo = JSON.parse(readFileSync("/tmp/demo-state.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  const list = await fetch("http://127.0.0.1:9222/json").then((r) => r.json());
  return list.find((t) => t.type === "page" && t.url === `chrome-extension://${EXT_ID}/${which}.html`);
}

const t = await getTarget();
if (!t) throw new Error("target " + which + " not found");
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

// 注入演示存储（幂等；popup/options 共享同一 storage）
const inject = `
  (async () => {
    const demo = ${JSON.stringify(demo)};
    await chrome.storage.local.set({
      v_env2: demo.envelope,
      v_meta2: demo.meta,
      v_settings2: { serverUrl: "https://nextjs-junkas-projects.vercel.app", autoLockMinutes: 10, syncChrome: true, syncCloud: true, deviceToken: "demo-device-token", deviceTokenName: "Junjie" },
      v_master_hash2: demo.masterHash,
    });
    return "injected";
  })()`;
await send("Runtime.evaluate", { expression: inject, awaitPromise: true });
await send("Page.reload", { ignoreCache: true });
await sleep(1600);

// 解锁（通用：所有密码框填 demo 密码，点含"解锁"的按钮）
const unlock = `
  (() => {
    document.querySelectorAll('input[type=password]').forEach(i => i.value = "${demo.password}");
    const b = [...document.querySelectorAll('button')].find(x => x.textContent && x.textContent.includes('解锁'));
    if (b) b.click();
    return !!b;
  })()`;
const r = await send("Runtime.evaluate", { expression: unlock, returnByValue: true });
console.log("unlock clicked:", r?.result?.value ?? false);
await sleep(2200);

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await sleep(600);
const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log("saved", out);
process.exit(0);