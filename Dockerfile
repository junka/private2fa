# Next.js standalone 官方多阶段构建：适用于 Railway / Render / Fly.io / Zeabur / 任意 Docker 主机
# 运行阶段只需 NODE_ENV 与平台注入的 PORT + 数据库/OAuth 环境变量，无需构建时连库

# 1) 依赖层：锁定 package-lock.json
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) 构建层
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate 只需 schema，不需要连接数据库
RUN npx prisma generate && npm run build

# 3) 运行层：最小化镜像，仅保留 standalone 产物
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# 非 root 运行，最小权限
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma 生成的 client 与查询引擎（standalone 静态追踪未必覆盖，显式保留）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
USER nextjs
EXPOSE 3000
# 启动时执行不可重复(idempotent)的迁移；新增表/列由 schema 演进，重复执行不产生副作用
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]