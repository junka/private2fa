# Private 2FA

自托管的私人双因素认证（2FA / TOTP）管理器。通过 GitHub / Google 账号登录后，可集中导入和管理你的 OTP 密钥，并在个人主页查看实时动态验证码。

> 当前阶段：本地已跑通完整链路 —— GitHub / Google 登录、OTP 密钥导入 / 管理、个人主页实时动态验证码（含倒计时）。待办：多用户数据隔离。

## 技术栈

- [Next.js 14](https://nextjs.org/)（App Router）
- [NextAuth.js 4](https://next-auth.js.org/)（GitHub / Google OAuth，JWT session）
- [Prisma](https://www.prisma.io/) + PostgreSQL
- [otpauth](https://github.com/hectorm/otpauth)（TOTP 解析与生成）
- Tailwind CSS

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

打开 http://localhost:3000 ，登录后进入「OTP 管理」页面。

## 功能

- [x] GitHub / Google OAuth 登录与登出（JWT session）
- [x] OTP 密钥管理：粘贴 `otpauth://` URL 导入、列表展示、删除
- [x] 个人主页实时展示 TOTP 验证码与倒计时进度条
- [ ] 多用户数据隔离（密钥与登录用户关联）

## 目录结构

```
app/
  api/auth/          NextAuth 路由
  api/otp/           OTP 导入 / 删除 API
  otp/               OTP 密钥管理页
  profile/           个人主页
  signin/ signout/   登录 / 登出页
components/          navbar、登录按钮、OTP 管理组件等
configs/
  nextauth.tsx       NextAuth 配置
  otp2fa.tsx         TOTP 生成逻辑
  prisma.tsx         Prisma Client 与数据访问函数
prisma/              schema 与迁移
```

## 部署

Vercel 一键部署需配置与本地相同的环境变量。构建流程（`vercel-build`）会自动执行：

```bash
prisma generate && prisma migrate deploy && next build
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

粘贴到「OTP 管理」页即可导入，个人主页会显示动态验证码。