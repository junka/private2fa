import { prisma } from "./prisma";

/** 云端统一保险箱：按用户读写 E2EE 密文，乐观锁仲裁（/api/sync 与 /api/vault 共用） */

export type VaultMeta = { version: number; updatedAt: number };

export async function loadUserVault(userId: string) {
  return prisma.vaultBackup.findUnique({ where: { userId } });
}

/**
 * 推送密文：用户无备份 → 创建；已有 → 严格版本仲裁（仅接受 version 严格更大）。
 * 返回 { ok, created, meta } 或 { conflict, meta }。
 */
export async function pushUserVault(
  userId: string,
  envelope: object,
  version: number,
  updatedAt: number
): Promise<
  | { ok: true; created: boolean; meta: VaultMeta }
  | { ok: false; conflict: true; meta: VaultMeta }
> {
  const ts = BigInt(Math.floor(updatedAt));
  try {
    const created = await prisma.vaultBackup.create({
      data: { userId, envelope, metaVersion: version, metaUpdatedAt: ts },
    });
    return { ok: true, created: true, meta: { version: created.metaVersion, updatedAt: Number(created.metaUpdatedAt) } };
  } catch (err) {
    // 并发首次推送：唯一约束冲突 → 走既有仲裁
    if (!(err as { code?: string }).code || (err as { code?: string }).code !== "P2002") throw err;
  }
  const existing = await prisma.vaultBackup.findUnique({ where: { userId } });
  if (!existing) throw new Error("vault vanished");
  if (version <= existing.metaVersion) {
    return {
      ok: false,
      conflict: true,
      meta: { version: existing.metaVersion, updatedAt: Number(existing.metaUpdatedAt) },
    };
  }
  const saved = await prisma.vaultBackup.update({
    where: { id: existing.id },
    data: { envelope, metaVersion: version, metaUpdatedAt: ts },
  });
  return { ok: true, created: false, meta: { version: saved.metaVersion, updatedAt: Number(saved.metaUpdatedAt) } };
}

/**
 * 一次性迁移：云端遗留旧版（v1 主密码 E2EE）信封时，服务端无法解密，
 * 以客户端推送的明文为准直接覆盖（含版本），从旧格式无缝切到账号密钥信封。
 */
export async function migrateUserVault(
  userId: string,
  envelope: object,
  version: number,
  updatedAt: number
): Promise<{ ok: true; created: boolean; meta: VaultMeta }> {
  const ts = BigInt(Math.floor(updatedAt));
  const existing = await prisma.vaultBackup.findUnique({ where: { userId } });
  if (existing) {
    const saved = await prisma.vaultBackup.update({
      where: { id: existing.id },
      data: { envelope, metaVersion: version, metaUpdatedAt: ts },
    });
    return { ok: true, created: false, meta: { version: saved.metaVersion, updatedAt: Number(saved.metaUpdatedAt) } };
  }
  const created = await prisma.vaultBackup.create({
    data: { userId, envelope, metaVersion: version, metaUpdatedAt: ts },
  });
  return { ok: true, created: true, meta: { version: created.metaVersion, updatedAt: Number(created.metaUpdatedAt) } };
}