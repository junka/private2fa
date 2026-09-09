import type { Envelope, Settings, VaultAccount, VaultData } from "../lib/types";
import browser from "webextension-polyfill";
import { encryptVault, decryptVault, hashPassword, verifyPassword } from "../lib/crypto";
import {
  loadEnvelopeLocal, saveLocal, loadSettings, saveSettings,
  setMasterHash, getMasterHash, mirrorToChromeSync, loadMetaLocal,
  clearChromeSync,
} from "../lib/storage";
import { pushToCloud, pullFromCloud, verifyDeviceToken } from "../lib/sync";
import { parseOtpauthUrl, upsertAccount, removeAccount, addGroup, removeGroup, setAccountGroup, bumpVersion } from "../lib/import";

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let settings: Settings;
let envelope: Envelope | null = null;
let vault: VaultData | null = null;
let password = "";
let unlocked = false;
// 来自 Web /connect 自动连接成功后的提示（渲染在页面顶部）
let connectNotice = "";

// ---------------- 解锁屏 ----------------

const lockScreen = () => `
  <div class="card lock-screen">
    <h1><span class="dot"></span>OTP Safebox 设置</h1>
    <div class="muted" style="margin-bottom:10px">管理密钥、分组与同步配置前，请先解锁保险库。</div>
    <input type="password" id="pw" placeholder="主密码" autocomplete="current-password" />
    <button class="btn-primary btn-sm" id="unlockBtn" style="margin-top:10px;width:100%;padding:9px">解锁</button>
    <div id="lockMsg"></div>
  </div>`;

// ---------------- 主设置页 ----------------

const mainScreen = () => {
  if (!vault) return "";
  const groups = vault.groups;
  return `
  <h1><span class="dot"></span>OTP Safebox 设置
    <span style="flex:1"></span>
    <span class="muted">v${vault.version}</span>
  </h1>

  <div class="card">
    <div class="export-row">
      <h2>密钥管理（${vault.accounts.length}）</h2>
      <span class="export-actions"><span class="status" id="exportMsg"></span><button class="btn-ghost btn-sm" id="exportBtn">导出备份</button></span>
    </div>
    <div class="muted" style="margin-bottom:6px">AES-256-GCM 加密存储于本机，Chrome/云端仅存密文。修改字段失焦后自动保存。</div>
    <div id="accounts">
      ${vault.accounts.length === 0 ? `<div class="empty">还没有密钥，请在下方批量导入或使用弹窗识别二维码</div>` : vault.accounts.map(acctRow).join("")}
    </div>
    <div class="status" id="editMsg"></div>
  </div>

  <div class="card">
    <h2>批量导入</h2>
    <div class="muted" style="margin-bottom:8px">粘贴 otpauth:// URL，支持多行批量；可选择导入到目标分组。</div>
    <textarea id="urlInput" placeholder="otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"></textarea>
    <div class="row" style="justify-content:space-between;margin-top:8px">
      <span style="display:flex;align-items:center;gap:8px">
        <span class="muted">导入到</span>
        <select id="importGroup" ${groups.length === 0 ? "disabled" : ""} style="width:auto;min-width:150px"><option value="">（未分组）</option>${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select>
        ${groups.length === 0 ? `<span class="muted">（暂无分组）</span>` : ""}
      </span>
      <button class="btn-primary btn-sm" id="importBtn">导入</button>
    </div>
    <div class="status" id="importMsg"></div>
  </div>

  <div class="card">
    <h2>分组管理</h2>
    <div id="groups">
      ${groups.length === 0 ? `<div class="empty">还没有分组</div>`
        : groups.map((g) => `
            <div class="group-item">
              <button class="btn-mini" data-movegroup="${esc(g.id)}" data-dir="-1" title="上移">↑</button>
              <button class="btn-mini" data-movegroup="${esc(g.id)}" data-dir="1" title="下移">↓</button>
              <input type="text" class="g-name" data-group="${esc(g.id)}" value="${esc(g.name)}" />
              <span class="muted">${vault!.accounts.filter((a) => a.groupId === g.id).length} 个</span>
              <button class="btn-danger btn-sm" data-delgroup="${esc(g.id)}">删除</button>
            </div>`).join("")}
    </div>
    <div class="row" style="margin-top:8px">
      <input type="text" id="groupName" placeholder="新分组名称" style="flex:1;min-width:0;width:auto" />
      <button class="btn-primary btn-sm btn-add" id="addGroupBtn"><span class="add-txt">添加</span><span class="add-x">＋</span></button>
    </div>
    <div class="status" id="groupMsg"></div>
  </div>

  <div class="card">
    <h2>同步与云端</h2>
    <div class="row"><span>随Chrome账户同步</span>
      <label class="switch"><input type="checkbox" id="optSyncChrome" ${settings.syncChrome ? "checked" : ""} /><span class="slider"></span></label>
    </div>
    <div class="row"><span>账号云同步</span>
      <label class="switch"><input type="checkbox" id="optSyncCloud" ${settings.syncCloud ? "checked" : ""} /><span class="slider"></span></label>
    </div>
    <div class="row"><span>后端地址</span>
      <input type="text" id="serverUrl" value="${esc(settings.serverUrl)}" style="max-width:300px" />
    </div>
    <div class="row">
      <span>设备令牌 <span class="muted clickable" id="goSignin" title="Web 登录后自动连接，无需手动复制">（一键连接账号 →）</span></span>
      <input type="text" id="deviceToken" placeholder="粘贴令牌（备用）" value="${esc(settings.deviceToken ?? "")}" style="max-width:300px" />
    </div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn-ghost btn-sm" id="verifyTokenBtn">验证令牌</button>
      <button class="btn-ghost btn-sm" id="manualSyncBtn">立即同步</button>
      <button class="btn-ghost btn-sm" id="pullCloudBtn">从云端拉取</button>
      <button class="btn-ghost btn-sm" id="clearL2Btn">清除 Chrome 镜像</button>
    </div>
    <div class="status" id="syncMsg"></div>
  </div>

  <div class="card">
    <h2>安全</h2>
    <div class="row"><span>自动锁定 <span class="muted">（分钟，0=不锁定）</span></span>
      <input type="number" id="autoLock" min="0" value="${settings.autoLockMinutes}" style="max-width:100px" />
    </div>
    <div class="row"><span>修改主密码</span>
      <button class="btn-ghost btn-sm" id="changePwBtn">修改</button>
    </div>
    <div class="row"><span>锁定保险库</span>
      <button class="btn-ghost btn-sm" id="lockBtn">立即锁定</button>
    </div>
  </div>`;
};

const acctRow = (a: VaultAccount) => `
  <div class="acct-item" data-id="${esc(a.id)}">
    <div class="acct-fields">
      <input type="text" class="f-issuer" data-account="${esc(a.id)}" value="${esc(a.issuer)}" placeholder="名称" title="名称" />
      <input type="text" class="f-label" data-account="${esc(a.id)}" value="${esc(a.label)}" placeholder="账户（用户名/邮箱）" title="账户" />
      <input type="text" class="f-secret" data-account="${esc(a.id)}" value="${esc(a.secret)}" placeholder="密钥 (base32)" title="密钥 (base32)" spellcheck="false" />
      <select class="f-group" data-account="${esc(a.id)}" title="分组">
        <option value="">（未分组）</option>
        ${(vault?.groups ?? []).map((g) => `<option value="${esc(g.id)}" ${a.groupId === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}
      </select>
    </div>
    <div class="acct-actions">
      <button class="btn-danger btn-sm" data-del="${esc(a.id)}">删除</button>
    </div>
  </div>`;

// ---------------- 渲染 ----------------

function render(): void {
  const app = $("app");
  const notice = connectNotice
    ? `<div class="card" id="connectNotice" style="border-color:${connectNotice.startsWith("✅") ? "var(--green)" : "var(--red)"}">
        <span style="color:${connectNotice.startsWith("✅") ? "var(--green)" : "var(--red)"}">${esc(connectNotice)}</span>
        <button class="btn-ghost btn-sm" id="closeNotice" style="float:right;padding:2px 8px">×</button>
      </div>`
    : "";
  app.innerHTML = notice + (unlocked && vault ? mainScreen() : lockScreen());
  const close = $("closeNotice");
  if (close) close.addEventListener("click", () => { connectNotice = ""; render(); });
  if (unlocked && vault) {
    const editMsg = () => $("editMsg");
    $("optSyncChrome").addEventListener("change", async (e) => {
      settings.syncChrome = (e.target as HTMLInputElement).checked;
      saveSettings(settings);
      if (settings.syncChrome && envelope) {
        await mirrorToChromeSync(envelope, { version: vault!.version, updatedAt: vault!.updatedAt });
      }
    });
    $("optSyncCloud").addEventListener("change", async (e) => {
      settings.syncCloud = (e.target as HTMLInputElement).checked;
      saveSettings(settings);
    });
    $("serverUrl").addEventListener("change", async (e) => {
      settings.serverUrl = (e.target as HTMLInputElement).value.trim();
      await saveSettings(settings);
    });
    $("autoLock").addEventListener("change", async (e) => {
      settings.autoLockMinutes = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
      await saveSettings(settings);
    });
    $("goSignin").addEventListener("click", () => openWebSignin());
    $("deviceToken").addEventListener("change", async (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      settings.deviceToken = v || null;
      if (!v) settings.deviceTokenName = null;
      await saveSettings(settings);
    });
    $("verifyTokenBtn").addEventListener("click", async () => {
      const msg = $("syncMsg");
      const token = ($("deviceToken") as HTMLInputElement).value.trim();
      if (!token) return (msg.textContent = "先粘贴设备令牌");
      settings.deviceToken = token;
      await saveSettings(settings);
      const r = await verifyDeviceToken(settings);
      msg.textContent = r.ok ? `令牌有效：${r.name ?? "未知设备"}` : `验证失败：${r.error}`;
      if (r.ok) {
        settings.deviceTokenName = r.name ?? null;
        await saveSettings(settings);
      }
    });
    $("manualSyncBtn").addEventListener("click", () => void manualSync($("syncMsg")));
    $("pullCloudBtn").addEventListener("click", () => void pullCloud($("syncMsg")));
    $("clearL2Btn").addEventListener("click", async () => {
      await clearChromeSync();
      $("syncMsg").textContent = "已清除 Chrome 同步镜像，本地数据不受影响";
    });
    $("importBtn").addEventListener("click", () => void doImport());
    $("exportBtn").addEventListener("click", () => void exportBackup($("exportMsg")));
    // 密钥行内编辑
    document.querySelectorAll<HTMLInputElement>(".f-issuer, .f-label, .f-secret").forEach((inp) =>
      inp.addEventListener("change", () => {
        const a = vault!.accounts.find((x) => x.id === inp.dataset.account);
        if (!a) return;
        if (inp.classList.contains("f-secret")) {
          a.secret = inp.value.replace(/\s+/g, "").toUpperCase();
          inp.value = a.secret;
        } else if (inp.classList.contains("f-issuer")) {
          a.issuer = inp.value.trim();
          inp.value = a.issuer;
        } else {
          a.label = inp.value.trim();
          inp.value = a.label;
        }
        upsertAccount(vault!, a);
        void commit(editMsg());
      })
    );
    document.querySelectorAll<HTMLSelectElement>(".f-group").forEach((s) =>
      s.addEventListener("change", () => {
        vault = setAccountGroup(vault!, s.dataset.account || "", s.value || null);
        void commit(editMsg());
      })
    );
    document.querySelectorAll<HTMLElement>("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm("删除该密钥？")) return;
        vault = removeAccount(vault!, b.dataset.del || "");
        void commitAndRender($("editMsg"));
      })
    );
    // 分组管理
    document.querySelectorAll<HTMLElement>("[data-movegroup]").forEach((b) =>
      b.addEventListener("click", () => moveGroup(b.dataset.movegroup || "", Number(b.dataset.dir)))
    );
    document.querySelectorAll<HTMLInputElement>(".g-name").forEach((inp) =>
      inp.addEventListener("change", () => {
        const g = vault!.groups.find((x) => x.id === inp.dataset.group);
        if (!g) return;
        const name = inp.value.trim();
        if (!name) return (inp.value = g.name);
        g.name = name;
        bumpVersion(vault!);
        void commitAndRender($("groupMsg"));
      })
    );
    document.querySelectorAll<HTMLElement>("[data-delgroup]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm("删除分组？组内密钥将变为未分组。")) return;
        vault = removeGroup(vault!, b.dataset.delgroup || "");
        void commitAndRender($("groupMsg"));
      })
    );
    $("addGroupBtn").addEventListener("click", () => {
      const name = ($("groupName") as HTMLInputElement).value.trim();
      if (!name) return;
      vault = addGroup(vault!, name);
      ($("groupName") as HTMLInputElement).value = "";
      void commitAndRender($("groupMsg"));
    });
    // 安全
    $("changePwBtn").addEventListener("click", () => void changePassword());
    $("lockBtn").addEventListener("click", () => {
      unlocked = false;
      vault = null;
      envelope = null;
      password = "";
      render();
    });
  } else {
    const pw = () => $("pw") as HTMLInputElement;
    $("unlockBtn").addEventListener("click", async () => {
      const msg = $("lockMsg");
      const hash = await getMasterHash();
      const p = pw().value;
      if (!hash || !(await verifyPassword(p, hash))) return (msg.textContent = "密码错误");
      try {
        envelope = await loadEnvelopeLocal();
        if (!envelope) throw new Error();
        vault = await decryptVault(envelope, p);
        password = p;
        unlocked = true;
        render();
      } catch {
        return (msg.textContent = "保险库解密失败，数据可能损坏");
      }
    });
    pw().addEventListener("keydown", (e) => { if (e.key === "Enter") ($("unlockBtn") as HTMLButtonElement).click(); });
  }
}

// ---------------- 动作 ----------------

function openWebSignin(): void {
  const serverUrl = (settings?.serverUrl || "http://localhost:3000").replace(/\/$/, "");
  const cid = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  void browser.runtime.sendMessage({ type: "connect-start", cid, serverUrl });
  void browser.tabs.create({ url: `${serverUrl}/connect?extid=${browser.runtime.id}&cid=${cid}` });
  const msg = $("syncMsg");
  if (msg) msg.textContent = "已打开网页，登录成功后令牌会自动回填，无需手动复制";
}

async function commit(msg?: HTMLElement): Promise<void> {
  if (!vault || !password) return;
  envelope = await encryptVault(vault, password);
  const meta = { version: vault.version, updatedAt: vault.updatedAt };
  await saveLocal(envelope, meta);
  if (settings.syncChrome) await mirrorToChromeSync(envelope, meta);
  if (msg) msg.textContent = `已保存并加密 · 触发同步 (v${vault.version})`;
}

async function commitAndRender(msg?: HTMLElement): Promise<void> {
  await commit(msg);
  render();
}

async function doImport(): Promise<void> {
  const msg = $("importMsg");
  const raw = ($("urlInput") as HTMLTextAreaElement).value;
  const groupId = ($("importGroup") as HTMLSelectElement).value || null;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    msg.textContent = "粘贴 otpauth:// URL";
    return;
  }
  let ok = 0, fail = 0;
  for (const line of lines) {
    try {
      const acct = parseOtpauthUrl(line);
      acct.groupId = groupId;
      vault = upsertAccount(vault!, acct);
      ok++;
    } catch {
      fail++;
    }
  }
  msg.className = fail ? "err" : "ok";
  msg.textContent = fail ? `成功 ${ok} 条，失败 ${fail} 条（请检查格式）` : `成功导入 ${ok} 条`;
  ($("urlInput") as HTMLTextAreaElement).value = "";
  await commit();
}

function moveGroup(id: string, dir: number): void {
  if (!vault) return;
  const gs = vault.groups;
  const i = gs.findIndex((g) => g.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= gs.length) return;
  gs.splice(j, 0, gs.splice(i, 1)[0]);
  gs.forEach((g, idx) => (g.order = idx));
  bumpVersion(vault);
  void commitAndRender($("groupMsg"));
}

async function exportBackup(msg: HTMLElement): Promise<void> {
  if (!vault) return;
  const lines = vault.accounts.map((a) => {
    const issuer = a.issuer ? `&issuer=${encodeURIComponent(a.issuer)}` : "";
    return `otpauth://totp/${encodeURIComponent(a.label)}?secret=${a.secret}&algorithm=${a.algorithm}&digits=${a.digits}&period=${a.period}${issuer}`;
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `otp-backup-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  msg.textContent = `已导出 ${vault.accounts.length} 条 otpauth:// 备份`;
}

async function changePassword(): Promise<void> {
  const p1 = prompt("输入新主密码（至少 8 位）");
  if (!p1) return;
  if (p1.length < 8) return alert("主密码至少 8 位");
  const p2 = prompt("再次输入新主密码");
  if (p1 !== p2) return alert("两次输入不一致");
  password = p1;
  await setMasterHash(await hashPassword(p1));
  await commitAndRender($("editMsg"));
  alert("主密码已更新");
}

async function manualSync(msg?: HTMLElement): Promise<void> {
  if (!envelope || !vault || !password) return;
  const meta = { version: vault.version, updatedAt: vault.updatedAt };
  if (!settings.syncCloud || !settings.deviceToken) {
    if (msg) msg.textContent = "未启用账号云同步或未连接设备，请先开启并粘贴令牌";
    return;
  }
  if (vault.accounts.length === 0) {
    if (msg) msg.textContent = "设备为空，不推送云端";
    return;
  }
  const res = await pushToCloud(settings, vault, meta);
  if (msg) {
    msg.textContent = res.ok
      ? `已推送 v${vault.version} 到云端`
      : res.conflict
        ? "云端有更新，先「从云端拉取」合并"
        : `推送失败：${res.error}`;
  }
}

async function pullCloud(msg?: HTMLElement): Promise<void> {
  if (!password) return;
  const res = await pullFromCloud(settings);
  if (res.notFound) {
    if (msg) msg.textContent = "云端无备份";
    return;
  }
  if (!res.ok) {
    if (msg) msg.textContent = `拉取失败：${res.error}`;
    return;
  }
  if (!res.vault || !res.meta) {
    if (msg) msg.textContent = "云端数据为空";
    return;
  }
  const localVersion = (await loadMetaLocal())?.version ?? 0;
  if (res.meta.version <= localVersion) {
    if (msg) msg.textContent = `本地已是最新 (v${localVersion})`;
    return;
  }
  const remote = res.vault;
  if (!confirm(`云端 v${res.meta.version} > 本地 v${localVersion}，覆盖本地？（远端 ${remote.accounts.length} 个密钥）`)) return;
  vault = remote;
  envelope = await encryptVault(remote, password);
  await saveLocal(envelope, res.meta);
  if (msg) msg.textContent = `已拉取 v${res.meta.version}（${remote.accounts.length} 个密钥）`;
  render();
}

// ---------------- 启动 ----------------

void (async () => {
  settings = await loadSettings();

  // 兼容清理旧的" · Chrome 扩展"尾巴
  if (settings.deviceTokenName && settings.deviceTokenName.includes(" · Chrome 扩展")) {
    settings.deviceTokenName = settings.deviceTokenName.replace(/ · Chrome 扩展.*$/, "");
    await saveSettings(settings);
  }

  // Web /connect 自动连接回跳：?connect=1&token=...&name=...，保存后清理 URL，避免令牌残留（备用通道）
  const q = new URLSearchParams(window.location.search);
  const token = q.get("token");
  if (q.get("connect") === "1" && token) {
    const name = q.get("name") || "已连接设备";
    settings.deviceToken = token;
    settings.deviceTokenName = name;
    await saveSettings(settings);
    const r = await verifyDeviceToken(settings);
    connectNotice = r.ok
      ? `✅ 已连接账号：${r.name ?? name}，可开启账号云同步`
      : `⚠️ 令牌已保存，但验证失败：${r.error ?? "未知错误"}`;
    history.replaceState(null, "", window.location.pathname);
  }

  render();
})();