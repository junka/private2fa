#!/usr/bin/env node
/** 生成商店截图用的演示保险库状态：真实加密信封 + 主密码指纹 + 设置（不触碰真实数据） */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildSync } from "esbuild";

const DEMO_PW = "demo1234";

// 1) bundle crypto lib（node 可跑的同一套 E2EE 原语）
const entry = "/tmp/gen-demo-entry.mjs";
writeFileSync(
  entry,
  `import { encryptVault, hashPassword } from "/Users/uqland/github/private2fa/chrome-extension/src/lib/crypto.ts";
const now = Date.now();
const g1 = "demo-g1", g2 = "demo-g2";
const vault = { version: 12, updatedAt: now, groups: [
  { id: g1, name: "工作", order: 0 }, { id: g2, name: "个人", order: 1 } ],
  accounts: [
    { id: "a1", groupId: g1, issuer: "GitHub", label: "Junjie", secret: "JBSWY3DPEHPK3PXP", algorithm: "SHA1", digits: 6, period: 30, createdAt: now, updatedAt: now },
    { id: "a2", groupId: g1, issuer: "Vercel", label: "site-admin", secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", algorithm: "SHA1", digits: 6, period: 30, createdAt: now, updatedAt: now },
    { id: "a3", groupId: g2, issuer: "Google", label: "Maimai", secret: "MFRGGZDFMZTWQ2LK", algorithm: "SHA1", digits: 6, period: 30, createdAt: now, updatedAt: now },
    { id: "a4", groupId: g1, issuer: "Cloudflare", label: "ops", secret: "ONSWG4TFOQYTKMBU", algorithm: "SHA1", digits: 6, period: 30, createdAt: now, updatedAt: now },
    { id: "a5", groupId: g1, issuer: "AWS", label: "root", secret: "ORSXG5AUNBZXIYTB", algorithm: "SHA1", digits: 6, period: 30, createdAt: now, updatedAt: now },
    { id: "a6", groupId: g2, issuer: "Microsoft", label: "个人账号", secret: "KRSXG5CTMVRXEZLU", algorithm: "SHA1", digits: 6, period: 30, createdAt: now, updatedAt: now },
  ]};
const envelope = await encryptVault(vault, ${JSON.stringify(DEMO_PW)});
const masterHash = await hashPassword(${JSON.stringify(DEMO_PW)});
console.log(JSON.stringify({ envelope, masterHash, meta: { version: vault.version, updatedAt: vault.updatedAt } }));`
);

const out = "/tmp/gen-demo.bundle.mjs";
buildSync({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", target: "node22", outfile: out, banner: { js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);' } });

const json = execFileSync("node", [out], { encoding: "utf8" });
const state = JSON.parse(json);
writeFileSync("/tmp/demo-state.json", JSON.stringify({ ...state, password: DEMO_PW }));
console.log("demo state generated -> /tmp/demo-state.json");