# Private 2FA

自托管的私人双因素认证（2FA / TOTP）管理器。通过 GitHub / Google 账号登录后，可集中导入和管理你的 OTP 密钥，并在个人主页查看实时动态验证码。

> 当前阶段：本地已跑通完整链路 —— GitHub / Google 登录、OTP 密钥导入 / 管理、个人主页实时动态验证码（含倒计时）。待办：多用户数据隔离。

## 技术栈

- [Next.js 15](https://nextjs.org/)（App Router）+ React 19
- [NextAuth.js 4](https://next-auth.js.org/)（GitHub / Google OAuth，JWT session）
- [Prisma](https://www.prisma.io/) + PostgreSQL
- [otpauth](https://github.com/hectorm/otpauth)（TOTP 解析与生成）
- Tailwind CSS
- Chrome 扩展（Manifest V3，`webextension-polyfill` 兼容 Chrome / Edge / Firefox）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

按需填写以下内容：

- **数据库**：`POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`（指向你的 PostgreSQL，如 [Supabase](https://supabase.com) 免费库）
- **NextAuth**：运行 `openssl rand -base64 32` 生成 `NEXTAUTH_SECRET`
- **OAuth**：到 [GitHub](https://github.com/settings/developers) 和 [Google 凭证控制台](https://console.cloud.google.com/apis/credentials) 创建应用，回调地址为 `http://localhost:3000/api/auth/callback/github`（或 `.../google`），填入对应 ID / Secret

> ⚠️ 若数据库密码包含 `@ : / # ?` 等特殊字符，连接串中需做 URL 编码（如池子里的 `!` → `%21`）。

### 3. 初始化数据库

已有迁移时使用：

```bash
npx prisma migrate deploy
```

若与你本地库结构不一致（或报 "schema is not empty"），可改用 `db push` 按当前 schema 幂等建表：

```bash
npx prisma db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 ，登录后进入「个人主页」（`/profile`，OTP 管理 + 实时验证码一体）。

## 功能

- [x] GitHub / Google OAuth 登录与登出（JWT session）
- [x] OTP 密钥管理：粘贴 `otpauth://` URL 导入、列表展示、删除
- [x] OTP 页面实时展示 TOTP 验证码与倒计时
- [x] 账号登录控制访问：登录即可查看 / 管理密钥，未登录无法访问
- [x] 云端统一保险箱（`/api/sync`，E2EE 密文，乐观锁版本仲裁）
- [x] Chrome 扩展：AES-256-GCM 本地加密、截图二维码识别导入、三层存储（本地 L1 / Chrome 同步镜像 L2 / 账号云同步 L3）
- [x] 安全防护：敏感 API IP 限频、设备连接 pending 上限、依赖漏洞扫描

## 目录结构

```
app/
  api/auth/           NextAuth 路由
  api/device-token/   设备令牌：连接 / 验证 / 轮询领取（含 pending 上限）
  api/vault/          云端保险箱读取 / 保存（账号密钥加密）
  api/otp/            遗留只读接口（旧数据一次性迁移）
  api/sync/           插件「立即同步」接口（与 Web 共用同一保险箱）
  connect/            插件 OAuth 式自动连接页
  privacy/            隐私政策页
  profile/            OTP 管理 + 个人主页（实时验证码，登录保护）
  otp/                旧路由，跳转至 /profile
  signin/ signout/    登录 / 登出页
  lib/                vault-crypto / vault-edit / device-auth / i18n
components/           navbar、登录按钮、vault-display 保险箱组件等
configs/              nextauth、prisma、cloud-vault、sync-vault、rate-limit、vault-cache
middleware.ts         CORS 头 + 敏感 API IP 限频
prisma/               schema 与迁移
chrome-extension/     浏览器扩展（独立小项目，见「Chrome 扩展」节）
.github/workflows/    CI / 发布流水线（见「CI 与自动发布」节）
```

## 部署

生产部署推荐 [Vercel](https://vercel.com) 一键部署。构建流程（`vercel-build`）会自动执行：

```bash
prisma generate && prisma migrate deploy && next build
```

### 方式一：Vercel Dashboard（推荐）

1. **导入仓库**：打开 https://vercel.com/new → Import 仓库 `junka/private2fa`，Framework 选择 Next.js（自动使用上面的 `vercel-build` 脚本）。
2. **配置环境变量**（Project → Settings → Environment Variables，共 8 个）：

   | 变量 | 说明 |
   | --- | --- |
   | `POSTGRES_PRISMA_URL` | Prisma 连接串（连接池形式，如 Supabase 的 `6543` 带 `pgbouncer=true`） |
   | `POSTGRES_URL_NON_POOLING` | 迁移直连串（非连接池，如 Supabase 的 `5432`） |
   | `NEXTAUTH_URL` | **生产域名**，如 `https://<项目名>.vercel.app`（不能是 `localhost`） |
   | `NEXTAUTH_SECRET` | 建议复用本地 `.env` 中的同一个值（`openssl rand -base64 32` 生成），否则现有登录会话全部失效 |
   | `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth App 凭据 |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 凭据 |

3. **Deploy**，等待构建完成即可访问。之后每次 push 到 main 分支会自动触发重新部署。

> ⚠️ **OAuth 回调域名**：把 `https://<项目名>.vercel.app/api/auth/callback/github` 和 `.../google` 分别加入 GitHub OAuth App 与 Google 凭证的「授权回调」白名单，否则登录会报 `redirect_uri` 错误。

### 方式二：Vercel CLI

```bash
vercel login                    # 首次需登录
vercel link                     # 关联项目
vercel env add NEXTAUTH_URL production    # 逐个添加上述 8 个变量
vercel env add GITHUB_SECRET production
# ... 其余变量同样添加
vercel --prod                   # 部署
```

### 数据库说明

- 部署使用与生产相同的 PostgreSQL（如 Supabase 免费库）。`prisma migrate deploy` 只应用 `prisma/migrations/` 中已有的迁移；若 schema 变更后尚未生成迁移（本地用 `prisma db push` 同步过），请先执行：

  ```bash
  npx prisma db push
  ```

- `prisma db push` 与 `migrate deploy` 幂等，可放心重复执行，不会清空数据。

## Chrome 扩展

`chrome-extension/` 是独立的小项目（自有 `package.json` / `tsconfig.json`），随 Web 端同一仓库维护。

```bash
cd chrome-extension
npm install
npm run build      # esbuild 打包到 dist/（popup / options / background / 图标）
npm run typecheck  # tsc --noEmit
```

手动打包（发布到商店）：

```bash
cd dist && zip -r ../release/otp-safebox-<版本>.zip . -x "*.DS_Store"
# Firefox 包用同样的 dist，命名加 -firefox 后缀
```

跨浏览器要点：

- **一个 manifest 通吃 Chrome / Edge / Firefox**：`background` 同时声明 `service_worker`（Chrome/Edge 使用）与 `scripts`（Firefox 以事件页模式运行，SW 字段被忽略会产生一条 AMO 静态警告，属预期可提交）
- Firefox 必需项：`browser_specific_settings.gecko.id`、`strict_min_version`（142+，`data_collection_permissions` 需该版本）、`data_collection_permissions` 声明不收集数据
- 扩展通过 Web 端 `middleware.ts` 的 CORS 头跨域请求 `/api/*`，manifest 无需 `host_permissions`

发布扩展走 GitHub Release（见下节），或直接取 `chrome-extension/release/` 下最新的 zip 上传商店。

## CI 与自动发布

| Workflow | 触发 | 内容 |
| --- | --- | --- |
| `build-extension.yml` | GitHub Release `published` / 手动 | 构建扩展 → `web-ext lint`（AMO 错误拦截）→ 打包 Chrome/Edge 与 Firefox 两个 zip → 上传为 Release 资产 |
| `ci.yml` | push main / PR | 服务端：`prisma generate` → `tsc --noEmit` → `eslint` → `next build` → `npm audit`（high/critical 严格失败） |
| `codeql.yml` | push main / PR / 每周 | CodeQL 静态安全扫描，结果见 `Security → Code scanning` |

发布扩展的标准流程：

```bash
git tag v0.1.1 && git push origin v0.1.1   # 推送 tag
# GitHub 上基于该 tag 创建 Release → 自动打包上传，无需本地手动打 zip
```

## 注意事项

- `.env` 已加入 `.gitignore`，请勿提交任何真实密钥
- 数据库迁移使用 `POSTGRES_URL_NON_POOLING`（直连），保持其为非连接池形式可避免迁移时产生悬挂数据库
- **GitHub 登录报 `OAuthCallbackError: issuer must be configured` 时**：GitHub 自 2026-04 起在 OAuth 回调中返回 RFC 9207 的 `iss` 参数，next-auth v4 要求显式声明 issuer，已在 [configs/nextauth.tsx](configs/nextauth.tsx) 中处理（`issuer: "https://github.com/login/oauth"`），复刻代码时请保留
- **登录回调报 `GetUserByAccountError` 时**：NextAuth 的 PrismaAdapter 依赖 `User` / `Account` / `Session` / `VerificationToken` 四张表（见 [prisma/schema.prisma](prisma/schema.prisma)），数据库缺表需同步 schema
- **验证 TOTP 是否正确**：导入后把同样的 secret 输进任意外部验证器（Authy / 1Password / 思想密码 等），与个人主页显示的 6 位码比对（30 秒一轮换）

## 测试用 OTP URL

```text
otpauth://totp/Private2FA:Test%3ADemo?issuer=Private2FA&secret=6HYJRTQTCJ55L7SYZEO3MSKDRVNK24ES&algorithm=SHA1&digits=6&period=30
```

粘贴到「个人主页」（`/profile`）的 OTP 管理区即可导入，页面实时显示动态验证码。