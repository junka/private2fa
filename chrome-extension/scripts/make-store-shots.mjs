#!/usr/bin/env node
/**
 * 生成 Chrome Web Store 提交用图片（产品视觉预览，无登录依赖）：
 *   screenshots/shot-1-vault.png   1280x800  主截图：保险箱列表
 *   screenshots/shot-2-add.png     1280x800  主截图：添加密钥
 *   screenshots/shot-3-sync.png    1280x800  主截图：云同步设置
 *   screenshots/tile-small.png     440x280   小型宣传图块
 *   screenshots/tile-marquee.png   1400x560  顶部宣传图块
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "release", "screenshots");
mkdirSync(outDir, { recursive: true });

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ---------- 公共视觉 ----------
const css = `
  * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif; }
  html,body { width:100%; height:100%; }
  .bg { width:100%; height:100%; background:radial-gradient(1200px 600px at 15% -10%, #312e81 0%, #1e1b4b 45%, #0b1030 100%); padding:64px 80px; display:flex; flex-direction:column; }
  .topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:40px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .brand .logo { width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#a78bfa); display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 8px 24px rgba(99,102,241,.45); }
  .brand .name { color:#fff; font-size:19px; font-weight:700; letter-spacing:.3px; }
  .brand .name small { display:block; color:#a5b4fc; font-size:11px; font-weight:400; margin-top:2px; letter-spacing:.5px; }
  .nav { display:flex; align-items:center; gap:6px; color:#c7d2fe; font-size:14px; }
  .nav a { padding:7px 14px; border-radius:8px; }
  .nav a.on { background:rgba(99,102,241,.25); color:#fff; }
  .chip { padding:7px 14px; border-radius:999px; font-size:12px; color:#e0e7ff; border:1px solid rgba(165,180,252,.4); }
  .panel { flex:1; display:flex; gap:36px; min-height:0; }
  .card { background:#fff; border-radius:18px; box-shadow:0 24px 60px rgba(2,6,23,.55); overflow:hidden; width:100%; max-width:760px; align-self:flex-start; }
  .card-head { padding:22px 26px 0; }
  .card-title { font-size:17px; font-weight:700; color:#0f172a; }
  .card-sub { font-size:12.5px; color:#64748b; margin-top:4px; }
  .rows { padding:14px 26px 26px; }
  .row { display:flex; align-items:center; justify-content:space-between; padding:15px 0; border-bottom:1px solid #f1f5f9; }
  .row:last-child { border-bottom:none; }
  .issuer { font-size:15px; font-weight:700; color:#0f172a; }
  .label { font-size:12.5px; color:#94a3b8; margin-top:2px; }
  .code { font-family:"SF Mono",Menlo,Consolas,monospace; font-size:26px; font-weight:600; letter-spacing:7px; color:#4f46e5; }
  .sec { display:flex; align-items:center; gap:10px; margin-top:8px; }
  .bar { width:74px; height:5px; border-radius:99px; background:#e2e8f0; overflow:hidden; }
  .bar i { display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,#6366f1,#a78bfa); }
  .sec b { font-size:11px; color:#94a3b8; font-weight:600; }
  .btn { border:1px solid #e2e8f0; border-radius:10px; padding:8px 16px; font-size:13px; color:#334155; }
  .copy { border-color:#4f46e5; color:#fff; background:#4f46e5; }
  .aside { width:300px; display:flex; flex-direction:column; gap:20px; }
  .minicard { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:20px; color:#e0e7ff; backdrop-filter:blur(6px); }
  .minicard h3 { font-size:14px; font-weight:700; color:#fff; margin-bottom:6px; }
  .minicard p { font-size:12px; color:#a5b4fc; line-height:1.7; }
  .ok { display:inline-flex; align-items:center; gap:7px; font-size:12.5px; color:#6ee7b7; background:rgba(16,185,129,.14); padding:7px 12px; border-radius:999px; font-weight:600; }
  .syncrow { display:flex; align-items:center; justify-content:space-between; padding:14px 0; border-bottom:1px solid #eef2f7; }
  .syncrow .t { font-size:14px; color:#0f172a; font-weight:600; }
  .syncrow .s { font-size:12px; color:#94a3b8; margin-top:3px; }
  .switch { width:44px; height:24px; border-radius:99px; background:#4f46e5; position:relative; }
  .switch::after { content:""; position:absolute; top:2px; right:2px; width:20px; height:20px; border-radius:50%; background:#fff; }
  input,textarea { width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; font-size:13px; font-family:Menlo,Consolas,monospace; color:#0f172a; background:#f8fafc; outline:none; }
  textarea { height:76px; resize:none; }
  .primary { background:#4f46e5; color:#fff; font-weight:600; }
  .minor { color:#5b6472; }
`;

// ---------- 通用页壳 ----------
const shell = (body, extraCss = "") => `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><style>${css}${extraCss}</style></head><body>${body}</body></html>`;

const topbar = (page, user = "Junjie") => `
  <div class="topbar">
    <div class="brand">
      <div class="logo">🔐</div>
      <div class="name">OTP Safebox<small>本地加密 · 隐私优先</small></div>
    </div>
    <div class="nav">
      <a class="${page === "home" ? "on" : ""}">首页</a>
      <a class="${page === "otp" ? "on" : ""}">OTP</a>
      <span class="chip">中 | EN</span>
      <span style="display:flex;align-items:center;gap:8px;padding:4px 6px 4px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)">
        <span style="font-size:13px;color:#e0e7ff;">${user}</span>
        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a78bfa);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff">${user[0]}</span>
      </span>
    </div>
  </div>`;

const otpRow = (issuer, label, code, pct, secs, withCopy = false) => `
  <div class="row">
    <div>
      <div class="issuer">${issuer}</div>
      <div class="label">${label}</div>
    </div>
    <div style="text-align:right">
      <div class="code">${code}</div>
      <div class="sec">
        <div class="bar"><i style="width:${pct}%"></i></div>
        <b>${secs}s</b>
        ${withCopy ? '<span class="btn copy" style="color:#fff">复制</span>' : ""}
      </div>
    </div>
  </div>`;

// ---------- 截图 1：保险箱列表 ----------
const shot1 = shell(`
  <div class="bg">
    ${topbar("otp")}
    <div class="panel">
      <div class="card">
        <div class="card-head">
          <div class="card-title">云端 OTP · 共 6 个密钥</div>
          <div class="card-sub">数据在服务端以账号密钥加密保存 · 服务器无法读取明文</div>
        </div>
        <div class="rows">
          ${otpRow("GitHub", "Junjie", "418 096", 62, 43, true)}
          ${otpRow("Google", "Maimai", "720 438", 15, 9)}
          ${otpRow("Cloudflare", "Ops 控制台", "593 217", 40, 27)}
          ${otpRow("Vercel", "site-admin", "881 652", 88, 55, true)}
          ${otpRow("Amazon", "aws-root", "324 701", 4, 2)}
        </div>
      </div>
      <div class="aside">
        <div class="minicard">
          <h3>🔒 端到端加密</h3>
          <p>密钥以 AES-256-GCM 加密，PBKDF2 310k 轮派生。服务端仅存密文，任何人无法读取您的验证码。</p>
        </div>
        <div class="minicard">
          <h3>🖼 截图识别导入</h3>
          <p>截图 / 粘贴 / 上传二维码图，自动识别 otpauth URL 并安全导入，支持批量。</p>
        </div>
      </div>
    </div>
  </div>
`);

// ---------- 截图 2：添加密钥 ----------
const shot2 = shell(`
  <div class="bg">
    ${topbar("otp")}
    <div class="panel">
      <div class="card">
        <div class="card-head">
          <div class="card-title">云保险箱</div>
          <div class="card-sub">${otpRow && ""}<span class="ok">✓ 已保存到云端，可在 Chrome 插件中同步</span></div>
        </div>
        <div class="rows">
          <div style="margin-bottom:10px">${inputArea()}</div>
          <div class="row" style="border:0;padding:10px 0 4px">
            <div><div class="issuer">GitHub</div><div class="label">Junjie</div></div>
            <div class="code" style="font-size:22px">418 096</div>
          </div>
          <div class="row">
            <div><div class="issuer">Vercel</div><div class="label">site-admin</div></div>
            <div class="code" style="font-size:22px">881 652</div>
          </div>
        </div>
      </div>
      <div class="aside">
        <div class="minicard">
          <h3>📋 批量导入</h3>
          <p>支持每行一个 otpauth:// URL，一次导入多个密钥，解析失败的行会自动跳过并提示。</p>
        </div>
        <div class="minicard">
          <h3>📱 跨设备同步</h3>
          <p>本地 → Chrome 账号 → 云端三层冗余，手机 / 电脑 / 插件随时互通。</p>
        </div>
      </div>
    </div>
  </div>
  ${inputAreaCss()}
`);

function inputArea() {
  return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc">
      <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-bottom:8px">添加密钥</div>
      <textarea placeholder="otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP&amp;issuer=GitHub">otpauth://totp/Google:Maimai?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&amp;issuer=Google</textarea>
      <div style="display:flex;gap:10px;margin-top:10px">
        <span class="btn primary" style="border:none">导入</span>
        <span class="btn minor">从二维码截图导入</span>
      </div>
    </div>
  `;
}
function inputAreaCss() {
  return `textarea:read-write { background:#fff; }`;
}

// ---------- 截图 3：云同步设置 ----------
const shot3 = shell(`
  <div class="bg" style="padding-top:56px">
    ${topbar("home")}
    <div class="panel">
      <div class="card" style="max-width:640px;margin:0 auto">
        <div class="card-head">
          <div class="card-title">同步与云端</div>
          <div class="card-sub">三层存储：本地(L1) → Chrome 账号(L2) → 自建云端(L3)</div>
        </div>
        <div class="rows">
          <div class="syncrow">
            <div><div class="t">随 Chrome 账户同步</div><div class="s">已开启 · 密文分片编码，配额自动监测</div></div>
            <div class="switch"></div>
          </div>
          <div class="syncrow">
            <div><div class="t">账号云同步</div><div class="s"><a style="color:#4f46e5;text-decoration:none;font-weight:600" href="#">Junjie</a> 已连接 · 设备 1</div></div>
            <span class="btn primary" style="border:none">立即同步</span>
          </div>
          <div class="syncrow">
            <div><div class="t">自动锁定</div><div class="s">离开 5 分钟后请求主密码</div></div>
            <div class="switch" style="background:#4f46e5"></div>
          </div>
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px 14px;font-size:12.5px;color:#4338ca;line-height:1.6">
            ✅ 上次同步：刚刚 · 云端版本 v9 · 已是最新状态
          </div>
        </div>
      </div>
    </div>
  </div>
`);

// ---------- 小型宣传图块 440x280 ----------
const tileSmall = (() => {
  const cssT = `
    * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,"PingFang SC",sans-serif; }
    html,body { width:100%; height:100%; }
    .wrap { width:100%; height:100%; background:radial-gradient(560px 440px at 20% -30%, #3730a3 0%, #1e1b4b 55%, #0b1030 100%); padding:34px 30px; display:flex; flex-direction:column; justify-content:space-between; }
    .top { display:flex; align-items:center; gap:14px; }
    .logo { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#6366f1,#a78bfa); display:flex; align-items:center; justify-content:center; font-size:26px; box-shadow:0 10px 24px rgba(99,102,241,.5); }
    .name { color:#fff; font-size:22px; font-weight:800; }
    .tag { color:#a5b4fc; font-size:12px; margin-top:3px; }
    .chips { display:flex; gap:8px; }
    .c { background:rgba(255,255,255,.92); border-radius:9px; padding:8px 12px; display:flex; flex-direction:column; align-items:center; }
    .c b { font-family:Menlo,monospace; font-size:13px; letter-spacing:2px; color:#4f46e5; }
    .c i { font-style:normal; font-size:9px; color:#94a3b8; margin-top:2px; }
  `;
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><style>${cssT}</style></head><body>
    <div class="wrap">
      <div class="top">
        <div class="logo">🔐</div>
        <div><div class="name">OTP Safebox</div><div class="tag">本地加密 · 隐私优先</div></div>
      </div>
      <div class="chips">
        <div class="c"><b>418 096</b><i>GitHub</i></div>
        <div class="c"><b>720 438</b><i>Google</i></div>
        <div class="c"><b>881 652</b><i>Vercel</i></div>
      </div>
    </div>
  </body></html>`;
})();

// ---------- 顶部宣传图块 1400x560 ----------
const tileMarquee = (() => {
  const cssT = `
    * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,"PingFang SC",sans-serif; }
    html,body { width:100%; height:100%; }
    .wrap { width:100%; height:100%; background:radial-gradient(1000px 500px at 15% 0%, #3730a3 0%, #1e1b4b 55%, #0b1030 100%); padding:64px 90px; display:flex; align-items:center; justify-content:space-between; gap:48px; }
    .left { max-width:600px; }
    .logo { width:64px; height:64px; border-radius:16px; background:linear-gradient(135deg,#6366f1,#a78bfa); display:flex; align-items:center; justify-content:center; font-size:32px; box-shadow:0 14px 34px rgba(99,102,241,.5); margin-bottom:26px; }
    h1 { color:#fff; font-size:46px; font-weight:800; line-height:1.15; letter-spacing:.5px; }
    .sub { color:#c7d2fe; font-size:18px; margin-top:16px; line-height:1.7; }
    .feats { display:flex; gap:12px; margin-top:28px; }
    .f { border:1px solid rgba(165,180,252,.4); color:#e0e7ff; font-size:14px; padding:9px 16px; border-radius:999px; background:rgba(255,255,255,.05); }
    .right { display:flex; gap:16px; }
    .vcard { background:#fff; border-radius:16px; box-shadow:0 24px 60px rgba(2,6,23,.6); padding:18px 20px; width:230px; }
    .vcard .i { font-size:14px; font-weight:700; color:#0f172a; }
    .vcard .l { font-size:11px; color:#94a3b8; margin-top:2px; }
    .vcard .code { font-family:Menlo,monospace; font-size:24px; font-weight:600; letter-spacing:5px; color:#4f46e5; margin:10px 0 8px; }
    .vcard .bar { height:5px; border-radius:99px; background:#e2e8f0; }
    .vcard .bar i { display:block; height:5px; border-radius:99px; background:linear-gradient(90deg,#6366f1,#a78bfa); }
    .vcard.up { margin-top:24px; transform:rotate(2deg); }
    .vcard.dn { transform:rotate(-3deg); }
  `;
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><style>${cssT}</style></head><body>
    <div class="wrap">
      <div class="left">
        <div class="logo">🔐</div>
        <h1>OTP Safebox<br>你的验证码保险箱</h1>
        <div class="sub">端到端加密，本地与云端双保险；<br>截图识别导入，跨设备随时同步。</div>
        <div class="feats">
          <span class="f">🖼 截图 / 图片导入</span>
          <span class="f">☁ 账号云同步</span>
          <span class="f">🔒 AES-256-GCM</span>
        </div>
      </div>
      <div class="right">
        <div class="vcard dn"><div class="i">GitHub</div><div class="l">Junjie</div><div class="code">418 096</div><div class="bar"><i style="width:62%"></i></div></div>
        <div class="vcard"><div class="i">Google</div><div class="l">Maimai</div><div class="code">720 438</div><div class="bar"><i style="width:15%"></i></div></div>
        <div class="vcard up"><div class="i">Vercel</div><div class="l">site-admin</div><div class="code">881 652</div><div class="bar"><i style="width:88%"></i></div></div>
      </div>
    </div>
  </body></html>`;
})();

// ---------- 写出并截图 ----------
const shots = [
  ["shot-1-vault.png", 1280, 800, shot1],
  ["shot-2-add.png", 1280, 800, shot2],
  ["shot-3-sync.png", 1280, 800, shot3],
  ["tile-small.png", 440, 280, tileSmall],
  ["tile-marquee.png", 1400, 560, tileMarquee],
];

const tmp = [];
for (const [name, w, h, html] of shots) {
  const htmlPath = join(outDir, name.replace(/\.png$/, ".html"));
  const pngPath = join(outDir, name);
  writeFileSync(htmlPath, html);
  execFileSync(CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${w},${h}`,
    `--screenshot=${pngPath}`,
    `file://${htmlPath}`,
  ], { stdio: "ignore" });
  tmp.push(htmlPath);
}
console.log("done ->", outDir);