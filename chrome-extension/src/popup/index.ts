import type { Envelope, Settings, VaultAccount, VaultData } from "../lib/types";
import browser from "webextension-polyfill";
import { encryptVault, decryptVault, hashPassword, verifyPassword, emptyVault } from "../lib/crypto";
import {
  K, loadEnvelopeLocal, saveLocal, loadSettings, saveSettings,
  setMasterHash, getMasterHash, mirrorToChromeSync, loadMetaLocal,
  onChromeSyncChanged,
} from "../lib/storage";
import { pushToCloud, pullFromCloud, fetchLegacyOtps, type LegacyOtp } from "../lib/sync";
import { generateCode, secondsLeft } from "../lib/totp";
import { upsertAccount, bumpVersion } from "../lib/import";
import { Secret } from "otpauth";
import {
  loadImageFromDataUrl, loadImageFromBlob, captureCurrentTab,
  scanQrFromImage, extractOtpauth, readClipboardImage,
} from "../lib/scanner";

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type View = "setup" | "locked" | "main";

let settings: Settings;
let envelope: Envelope | null = null;
let vault: VaultData | null = null;
let password = "";
let curGroup = "__all__";
let timer: number | null = null;
// 自动连接进行中（后台 SW 轮询领取令牌，完成后同步卡直接显示账号）
let connecting = false;

function render(): void {
  const app = $("app");
  const view: View = !(getMasterHashSync()) ? "setup" : vault ? "main" : "locked";
  const parsed = new DOMParser().parseFromString(view === "setup" ? setupHtml() : view === "locked" ? lockedHtml() : mainHtml(), "text/html");
  app.replaceChildren(...Array.from(parsed.body.childNodes));
  bind(view);
  if (view === "main") startTicker();
}

// -- 同步（getMasterHash 是 async，这里做同步缓存标记） --
let masterHashCache: string | null = "unloaded";
const getMasterHashSync = () => (masterHashCache === "unloaded" ? null : masterHashCache);

/** 兼容清理旧的" · Chrome 扩展"尾巴（历史版本曾把设备名后缀存进 deviceTokenName） */
async function sanitizeAccountName(): Promise<void> {
  if (settings.deviceTokenName && settings.deviceTokenName.includes(" · Chrome 扩展")) {
    settings.deviceTokenName = settings.deviceTokenName.replace(/ · Chrome 扩展.*$/, "");
    await saveSettings(settings);
  }
}

void (async () => {
  settings = await loadSettings();
  await sanitizeAccountName();
  masterHashCache = await getMasterHash();
  if (masterHashCache) {
    envelope = await loadEnvelopeLocal();
  }
  const { ["v_connect_pending2"]: pend } = await browser.storage.local.get("v_connect_pending2");
  if (pend) connecting = true; // 连接进行中：网页完成后自动回填
  render();
})();

// ---------------- 视图 HTML ----------------

const setupHtml = () => `
  <h1><span class="dot"></span>OTP Safebox</h1>
  <div class="card">
    <div class="label">首次使用 · 设置主密码</div>
    <div class="muted" style="margin-top:4px">主密码只在本机派生密钥，不会上传。忘记密码将无法解密保险库。</div>
    <input type="password" id="pw1" placeholder="主密码" style="margin-top:10px" autocomplete="new-password" />
    <input type="password" id="pw2" placeholder="确认主密码" style="margin-top:8px" autocomplete="new-password" />
    <button class="btn-primary btn-block" id="setupBtn">创建保险库</button>
    <div id="msg"></div>
  </div>`;

const lockedHtml = () => `
  <h1><span class="dot"></span>OTP Safebox</h1>
  <div class="card">
    <div class="label">已锁定</div>
    <input type="password" id="pw" placeholder="主密码" style="margin-top:10px" autocomplete="current-password" />
    <button class="btn-primary btn-block" id="unlockBtn">解锁</button>
    <div id="lockMsg"></div>
  </div>`;

const mainHtml = () => {
  if (!vault) return "";
  const base = (settings.serverUrl || "http://localhost:3000").replace(/\/$/, "");
  const g = curGroup === "__all__" ? null : curGroup;
  const list = vault!.accounts
    .filter((a) => !g || a.groupId === g)
    .sort((a, b) => a.issuer.localeCompare(b.issuer) || a.label.localeCompare(b.label));
  const chips = `
    <span class="chip ${curGroup === "__all__" ? "active" : ""}" data-g="__all__">全部</span>
    ${vault!.groups.map((x) =>
      `<span class="chip ${curGroup === x.id ? "active" : ""}" data-g="${esc(x.id)}">${esc(x.name)}</span>`
    ).join("")}`;
  return `
  <h1><span class="dot"></span>OTP Safebox
    <span style="flex:1"></span>
    <button class="opts-btn" id="openOpts" title="打开设置">⚙ 设置</button>
  </h1>
  <div class="card">
    <div class="label">同步</div>
    <div class="row" style="margin-top:8px">
      <span class="muted">随Chrome账户同步</span>
      <span class="muted">${settings.syncChrome ? "已开启" : "未开启"}</span>
    </div>
    ${
      settings.syncCloud
        ? `
    <div class="row" style="margin-top:8px">
      ${
        settings.deviceToken
          ? `<a class="acct-link" href="${esc(base)}/profile" target="_blank" title="在网页端查看账号" style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--indigo);text-decoration:none">${esc(settings.deviceTokenName ?? "已连接账号")}</a>
             <span class="muted clickable" id="syncNow" style="flex-shrink:0" title="立即推送本地密文到云端">立即同步</span>`
          : `<span class="muted clickable" id="goSignin" style="flex:1;text-align:left">登录 / 注册账号 →</span>`
      }
    </div>
    <div class="status" id="syncStatus"${settings.deviceToken ? " style=\"display:none\"" : ""}>${connecting ? "连接中…网页完成登录后自动回填" : "尚未连接账号，开启后可在多端同步"}</div>`
        : `<div class="muted" style="margin-top:6px">账号云同步未开启 · 可到设置页开启</div>`
    }
  </div>
  <div class="card" style="margin-top:10px">
    <div class="row">
      <span class="label">快速添加</span>
      <span style="flex:1"></span>
      <button class="btn-ghost btn-sm" id="scanTab" title="截取当前页面识别二维码">📷 截图</button>
      <button class="btn-ghost btn-sm" id="pickImg" title="选择本地图片识别二维码">🖼 图片</button>
      <button class="btn-ghost btn-sm" id="pasteImg" title="读取剪贴板图片">📋 粘贴</button>
    </div>
    <input type="file" id="imgFile" accept="image/*" style="display:none" />
    <div class="status" id="scanStatus">识别到的 otpauth:// 二维码将导入当前分组</div>
  </div>
  <div class="card" style="margin-top:10px">
    <div class="row" style="margin-bottom:8px">${chips}</div>
    <div id="list">
      ${list.length === 0
        ? `<div class="empty">还没有密钥 ${curGroup === "__all__" ? "" : "（该分组为空）"}<br><span class="muted">到 options 页粘贴 otpauth:// URL 导入</span></div>`
        : list.map(acctHtml).join("")}
    </div>
  </div>
  <div class="hint">点击验证码复制 · 自动每 ${vault!.accounts[0]?.period ?? 30}s 刷新</div>`;
};

const acctHtml = (a: VaultAccount) => {
  const left = secondsLeft(a);
  const percent = Math.max(0, Math.min(100, (left / a.period) * 100));
  return `<div class="acct" data-id="${esc(a.id)}">
    <div class="name">
      <div>${esc(a.issuer || "未命名")}</div>
      <div class="issuer">${esc(a.label)}</div>
    </div>
    <div style="text-align:right">
      <div class="code" data-code="${esc(a.id)}">${generateCode(a)}</div>
      <div class="progress"><i style="width:${percent}%"></i></div>
    </div>
    <span class="copy" data-copy="${esc(a.id)}">⧉</span>
  </div>`;
};

// ---------------- 事件绑定 ----------------

function bind(view: View): void {
  if (view === "setup") {
    $("setupBtn").addEventListener("click", async () => {
      const p1 = ($("pw1") as HTMLInputElement).value;
      const p2 = ($("pw2") as HTMLInputElement).value;
      const msg = $("msg");
      if (p1.length < 8) return (msg.textContent = "主密码至少 8 位");
      if (p1 !== p2) return (msg.textContent = "两次输入不一致");
      vault = emptyVault();
      password = p1;
      envelope = await encryptVault(vault, password);
      await saveLocal(envelope, { version: vault.version, updatedAt: vault.updatedAt });
      await setMasterHash(await hashPassword(p1));
      masterHashCache = await getMasterHash();
      await trySyncAll();
      render();
    });
  }
  if (view === "locked") {
    $("unlockBtn").addEventListener("click", async () => {
      const p = ($("pw") as HTMLInputElement).value;
      const msg = $("lockMsg");
      if (!masterHashCache || !(await verifyPassword(p, masterHashCache))) {
        return (msg.textContent = "密码错误");
      }
      try {
        if (!envelope) envelope = await loadEnvelopeLocal();
        if (!envelope) throw new Error();
        vault = await decryptVault(envelope, p);
        password = p;
        render();
      } catch {
        return (msg.textContent = "保险库解密失败，数据可能损坏");
      }
    });
    const enter = (e: KeyboardEvent) => { if (e.key === "Enter") ($("unlockBtn") as HTMLButtonElement).click(); };
    $("pw").addEventListener("keydown", enter);
  }
  if (view === "main") {
    $("openOpts").addEventListener("click", (e) => { e.preventDefault(); browser.runtime.openOptionsPage(); });
    const goSignin = $("goSignin");
    if (goSignin) goSignin.addEventListener("click", () => {
      const serverUrl = (settings.serverUrl || "http://localhost:3000").replace(/\/$/, "");
      const cid = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      void browser.runtime.sendMessage({ type: "connect-start", cid, serverUrl });
      void browser.tabs.create({ url: `${serverUrl}/connect?extid=${browser.runtime.id}&cid=${cid}` });
      connecting = true;
      render();
    });
    const syncNow = $("syncNow");
    if (syncNow) syncNow.addEventListener("click", () => void twoWaySync());
    // 快速添加：截图 / 图片 / 剪贴板识别二维码
    $("scanTab").addEventListener("click", () => void scanSource("tab"));
    $("pickImg").addEventListener("click", () => $("imgFile").click());
    $("imgFile").addEventListener("change", async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) await scanBlob(f);
      (e.target as HTMLInputElement).value = "";
    });
    $("pasteImg").addEventListener("click", () => void scanSource("clipboard"));
    document.querySelectorAll(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        curGroup = (c as HTMLElement).dataset.g || "__all__";
        render();
      })
    );
    document.querySelectorAll("[data-copy]").forEach((el) =>
      el.addEventListener("click", () => copyCode((el as HTMLElement).dataset.copy || ""))
    );
  }
}

async function copyCode(id: string): Promise<void> {
  const a = vault?.accounts.find((x) => x.id === id);
  if (!a) return;
  try {
    await navigator.clipboard.writeText(generateCode(a));
  } catch {
    /* 剪贴板拒绝时静默 */
  }
}

// ---------------- 定时刷新 ----------------

function startTicker(): void {
  if (timer) clearInterval(timer);
  timer = window.setInterval(() => {
    if (!vault) return;
    document.querySelectorAll<HTMLElement>(".acct").forEach((row) => {
      const id = row.dataset.id || "";
      const a = vault!.accounts.find((x) => x.id === id);
      if (!a) return;
      const left = secondsLeft(a);
      const percent = Math.max(0, Math.min(100, (left / a.period) * 100));
      const bar = row.querySelector(".progress > i") as HTMLElement | null;
      if (bar) bar.style.width = `${percent}%`;
      if (left === a.period || left === a.period - 1) {
        const codeEl = row.querySelector<HTMLElement>(".code");
        if (codeEl) codeEl.textContent = generateCode(a);
      }
    });
  }, 500);
}

// ---------------- 截图/图片识别导入 ----------------

let scanning = false;

function scanStatus(text: string, isErr = false): void {
  const el = document.getElementById("scanStatus");
  if (el) {
    el.textContent = text;
    el.className = "status " + (isErr ? "err" : "");
  }
}

async function scanSource(kind: "tab" | "clipboard"): Promise<void> {
  if (scanning) return;
  if (!vault || !password) return;
  scanning = true;
  scanStatus("识别中…");
  try {
    if (kind === "tab") {
      const dataUrl = await captureCurrentTab();
      await scanFromImage(await loadImageFromDataUrl(dataUrl));
    } else {
      const blob = await readClipboardImage();
      if (!blob) throw new Error("剪贴板中没有图片");
      await scanFromImage(await loadImageFromBlob(blob));
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "识别失败";
    scanStatus(m.startsWith("截取") ? "截屏失败：需在当前标签页授权，请点击插件图标后再试" : m, true);
  } finally {
    scanning = false;
  }
}

async function scanBlob(blob: Blob): Promise<void> {
  if (scanning) return;
  if (!vault || !password) return;
  scanning = true;
  scanStatus("识别中…");
  try {
    await scanFromImage(await loadImageFromBlob(blob));
  } catch (e) {
    scanStatus(e instanceof Error ? e.message : "识别失败", true);
  } finally {
    scanning = false;
  }
}

async function scanFromImage(img: HTMLImageElement): Promise<void> {
  const text = await scanQrFromImage(img);
  if (!text) {
    scanStatus("未识别到二维码，换个更清晰的角度/图片", true);
    return;
  }
  const accounts = extractOtpauth(text);
  if (!accounts.length) {
    scanStatus("识别到二维码，但不是 otpauth:// 密钥", true);
    return;
  }
  // 导入当前分组
  const groupId = curGroup === "__all__" ? null : curGroup;
  for (const a of accounts) {
    a.groupId = groupId;
    upsertAccount(vault!, a);
  }
  envelope = await encryptVault(vault!, password);
  await saveLocal(envelope, { version: vault!.version, updatedAt: vault!.updatedAt });
  await trySyncAll();
  render();
  scanStatus(`✅ 已识别并导入 ${accounts.length} 个密钥`, false);
}

// ---------------- 三层同步 ----------------

type Meta = { version: number; updatedAt: number };

/** 写入同步状态行；无内容时隐藏（连接后静态"已连接账号"不再重复展示） */
function setSyncStatus(text: string): void {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.textContent = text;
  el.style.display = text ? "" : "none";
}

async function trySyncAll(): Promise<void> {
  if (!envelope || !vault) return;
  const meta: Meta = { version: vault.version, updatedAt: vault.updatedAt };

  // 设备端为空：没必要写入云端
  if (vault.accounts.length === 0) {
    setSyncStatus("设备为空，不推送云端");
    return;
  }

  // L2：本地为准，写后回读（Chrome 官方通道不做覆盖决策，仅作冗余）
  if (settings.syncChrome) {
    const ok = await mirrorToChromeSync(envelope, meta);
    if (!ok) setSyncStatus("Chrome 同步镜像失败（配额？），已保持本地");
  }
  // L3：主动推送 + 冲突仲裁
  if (settings.syncCloud && settings.deviceToken) {
    const res = await pushToCloud(settings, vault, meta);
    if (res.ok) setSyncStatus(`已推送到云端 · v${vault.version}`);
    else if (res.conflict) setSyncStatus("云端有更新，点击立即同步执行拉取合并");
    else if (res.error) setSyncStatus(`推送失败：${res.error}`);
  }
}

/** 双向同步（立即同步）：先拉取云端最新，再迁移网页端遗留数据，最后按版本推本地。last-writer-wins。 */
async function twoWaySync(): Promise<void> {
  if (!envelope || !vault || !password) return;
  let meta: Meta = { version: vault.version, updatedAt: vault.updatedAt };

  // L2：本地为准，写后回读（Chrome 官方通道不做覆盖决策，仅作冗余）
  if (settings.syncChrome) {
    const ok = await mirrorToChromeSync(envelope, meta);
    if (!ok) setSyncStatus("Chrome 同步镜像失败（配额？），已保持本地");
  }
  if (!(settings.syncCloud && settings.deviceToken)) return;

  setSyncStatus("同步中…");
  let needPush = true; // 本地是否需要推送（已被远端覆盖/相同则无需）
  // 1) 拉取云端：版本更大或同版本时内容更新 → 采用远端
  const pull = await pullFromCloud(settings);
  if (pull.notFound) {
    // 云端还没备份：推送本地建立
  } else if (pull.legacy) {
    // 云端仍是旧版主密码 E2EE 信封（服务端不可解密）：以本地明文为准覆盖迁移
    setSyncStatus("云端是旧版加密格式，将用本地数据覆盖升级");
  } else if (!pull.ok) {
    setSyncStatus(`同步失败：${pull.error}`);
    return;
  } else if (pull.vault && pull.meta) {
    const remoteNewer =
      pull.meta.version > meta.version ||
      (pull.meta.version === meta.version && pull.meta.updatedAt > meta.updatedAt);
    if (remoteNewer) {
      const remoteVault = pull.vault;
      vault = remoteVault;
      envelope = await encryptVault(remoteVault, password);
      meta = { version: pull.meta.version, updatedAt: pull.meta.updatedAt };
      await saveLocal(envelope, meta);
      render();
      needPush = false;
    } else if (pull.meta.version === meta.version) {
      setSyncStatus(`已是最新 (v${meta.version})`);
      needPush = false;
    }
    // 本地版本更高 → 保持 needPush
  }

  // 2) 网页端遗留数据迁移（一次性；Web 端已不再展示密钥）
  const legacyRes = await fetchLegacyOtps(settings);
  if (legacyRes.ok && legacyRes.otps.length > 0) {
    if (window.confirm(`检测到 ${legacyRes.otps.length} 条旧网页端密钥，导入到本机保险库？`)) {
      for (const o of legacyRes.otps) upsertAccount(vault!, legacyToAccount(o));
      envelope = await encryptVault(vault!, password);
      meta = { version: vault!.version, updatedAt: vault!.updatedAt };
      await saveLocal(envelope, meta);
      needPush = true;
      render();
      setSyncStatus(`已导入 ${legacyRes.otps.length} 条旧密钥并保存`);
    }
  }

  if (!needPush) return;
  // 3) 推送本地（设备端为空不写入云端）
  if (vault.accounts.length === 0) {
    setSyncStatus("设备为空，不推送云端");
    return;
  }
  const res = await pushToCloud(settings, vault, meta);
  if (res.ok) setSyncStatus(`已同步到云端 · v${meta.version}`);
  else if (res.conflict) setSyncStatus("云端有更新，请再次点击立即同步");
  else setSyncStatus(`推送失败：${res.error}`);
}

/** 网页端遗留明文（hex secret）→ 本地账户（base32 secret） */
function legacyToAccount(o: LegacyOtp): VaultAccount {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    groupId: null,
    issuer: o.issuer ?? "",
    label: o.label ?? "",
    secret: Secret.fromHex(o.secret).base32,
    algorithm: (["SHA1", "SHA256", "SHA512"].includes(o.algorithm) ? o.algorithm : "SHA1") as VaultAccount["algorithm"],
    digits: Number(o.digits) || 6,
    period: Number(o.period) || 30,
    createdAt: now,
    updatedAt: now,
  };
}

// popup 挂载后：检测 L2 远端更新（被动同步展示提示）
onChromeSyncChanged(({ meta }) => {
  if (!meta || !settings.syncChrome) return;
  void (async () => {
    const localMeta = await loadMetaLocal();
    if (localMeta && meta.version > localMeta.version && window.confirm("检测到另一浏览器的更新，立即拉取？")) {
      await pullCloudFromL2();
    }
  })();
});

async function pullCloudFromL2(): Promise<void> {
  // L2 的密文可直接解密（同一密码派生），直接采用
  if (!password) return;
  const { envelope: e2, meta: m2 } = await import("../lib/storage").then((m) => m.readChromeSync());
  if (!e2 || !m2) return;
  vault = await decryptVault(e2, password);
  envelope = e2;
  await saveLocal(e2, m2);
  render();
}