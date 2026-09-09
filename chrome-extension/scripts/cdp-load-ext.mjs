#!/usr/bin/env node
/** 用 CDP Extensions.loadUnpacked 加载扩展并打开 options/popup 页（browser 级 ws） */
const EXT_ID = "congbelljckfecpfjopmgfenalcjbpfi";

async function main() {
  const ver = await fetch("http://127.0.0.1:9222/json/version").then((r) => r.json());
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seed = 1;
  const send = (method, params = {}) => new Promise((res) => {
    const id = seed++;
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.id === id) { ws.removeEventListener("message", h); res(m.result ?? m); } };
    ws.addEventListener("message", h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const loaded = await send("Extensions.loadUnpacked", { path: "/Users/uqland/github/private2fa/chrome-extension/dist" });
  const extId = loaded?.extensionId || EXT_ID;
  console.log("loaded ext:", extId);

  const t1 = await send("Target.createTarget", { url: `chrome-extension://${extId}/options.html` });
  const t2 = await send("Target.createTarget", { url: `chrome-extension://${extId}/popup.html` });
  console.log("targets:", t1?.targetId, t2?.targetId);
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });