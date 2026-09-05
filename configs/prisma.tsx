import { PrismaClient } from '@prisma/client';

// Next dev 热更新会重复加载本模块；globalThis 单例保证连接池只建一次，
// 避免每次编辑文件都重建客户端、重连远端库（首次冷连接 3-5s）。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 启动预热：提前建立与远端库的连接，让首个请求命中热连接而非承担 TLS/握手成本
void prisma.$connect().catch((err: unknown) => {
  console.error('[prisma] initial connect failed:', err);
});

export async function findAllOtps() {
    return prisma.optsecret.findMany({
        orderBy: { id: 'desc' }
    })
}