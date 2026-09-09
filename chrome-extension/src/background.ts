// 后台服务（MV3 SW）：OAuth 自动连接的轮询领取端。
// 用户点击「登录 / 注册账号」→ 页面生成随机 cid 并发消息 connect-start；
// 本端存下 {cid, serverUrl}，周期性轮询 /api/device-token/pending?cid，拿到令牌即自动写入 settings。
// Chrome 禁止 Web 页顶层跳回 chrome-extension://，因此令牌必须由扩展主动取回。

import browser from "webextension-polyfill";
import { loadSettings, saveSettings } from "./lib/storage";

const PENDING = "v_connect_pending2";
const ALARM = "connectPoll";
const TTL_MS = 10 * 60 * 1000; // 与后端 pending 暂存 TTL 对齐

async function pollOnce(): Promise<void> {
  const { [PENDING]: p } = await browser.storage.local.get(PENDING);
  if (!p) {
    await browser.alarms.clear(ALARM);
    return;
  }
  if (Date.now() - p.startedAt > TTL_MS) {
    await browser.storage.local.remove(PENDING);
    await browser.alarms.clear(ALARM);
    return;
  }
  try {
    const res = await fetch(
      `${(p.serverUrl as string).replace(/\/$/, "")}/api/device-token/pending?cid=${encodeURIComponent(p.cid as string)}`
    );
    if (res.status === 200) {
      const body = (await res.json()) as { token?: string; name?: string };
      if (body.token) {
        const settings = await loadSettings();
        settings.deviceToken = body.token;
        settings.deviceTokenName = body.name ?? "已连接设备";
        await saveSettings(settings);
        await browser.storage.local.remove(PENDING);
        await browser.alarms.clear(ALARM);
      }
    }
  } catch {
    // 网络抖动/后端未就绪：保持轮询，交给下一次 alarm
  }
}

browser.runtime.onMessage.addListener((msg: any, _sender: any, sendResponse: any) => {
  if (msg?.type === "connect-start") {
    void (async () => {
      await browser.storage.local.set({
        [PENDING]: { cid: msg.cid as string, serverUrl: msg.serverUrl as string, startedAt: Date.now() },
      });
      await browser.alarms.create(ALARM, { periodInMinutes: 0.5 }); // unpacked 最小周期 30s
      await pollOnce(); // 立即尝试一次（此刻多半还未建令牌，交给后续轮询）
      setTimeout(() => void pollOnce(), 5000); // 加快一次
    })().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "connect-cancel") {
    void (async () => {
      await browser.storage.local.remove(PENDING);
      await browser.alarms.clear(ALARM);
    })().then(() => sendResponse({ ok: true }));
    return true;
  }
  return undefined;
});

browser.alarms.onAlarm.addListener((alarm: any) => {
  if (alarm.name === ALARM) void pollOnce();
});