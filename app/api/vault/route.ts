import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/configs/nextauth";
import { prisma } from "@/configs/prisma";
import { loadUserVault, pushUserVault, migrateUserVault } from "@/configs/sync-vault";
import { encryptCloud, decryptCloud, isCloudVault, isLegacyCloudEnvelope, type CloudEnvelope } from "@/configs/cloud-vault";
import { getVaultCache, setVaultCache, invalidateVaultCache } from "@/configs/vault-cache";

/**
 * Web 端云端保险箱（session 鉴权）：与插件 /api/sync 读写同一份账号密钥加密的数据。
 * 登录即可读明文（无主密码）；服务端持账号密钥负责加解密。
 */

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as { id?: string })?.id ?? null;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 命中缓存：免远端库查询与解密，秒开
  const cached = getVaultCache(userId);
  if (cached) return NextResponse.json(cached);
  const vault = await loadUserVault(userId);
  if (!vault) return NextResponse.json({ error: "backup not found" }, { status: 404 });
  // 旧版 v1 信封（主密码 E2EE）：服务端无法解密，标记 legacy 提示在插件中重新同步迁移
  if (isLegacyCloudEnvelope(vault.envelope)) {
    return NextResponse.json({
      legacy: true,
      meta: { version: vault.metaVersion, updatedAt: Number(vault.metaUpdatedAt) },
    });
  }
  let cloud: unknown;
  try {
    cloud = await decryptCloud(userId, vault.envelope as unknown as CloudEnvelope);
  } catch (err) {
    console.error("[vault] decrypt cloud failed:", err);
    return NextResponse.json({ error: "cloud decrypt failed" }, { status: 500 });
  }
  const meta = { version: vault.metaVersion, updatedAt: Number(vault.metaUpdatedAt) };
  setVaultCache(userId, cloud, meta);
  return NextResponse.json({ vault: cloud, meta });
}

export async function POST(request: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { vault?: unknown; meta?: { version?: unknown; updatedAt?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const version = body.meta?.version;
  const updatedAt = body.meta?.updatedAt;
  if (
    !isCloudVault(body.vault) ||
    typeof version !== "number" ||
    typeof updatedAt !== "number"
  ) {
    return NextResponse.json({ error: "missing vault or meta" }, { status: 400 });
  }

  const envelope = await encryptCloud(userId, body.vault);
  // 云端遗留旧版 v1 信封 → 以客户端为准直接覆盖（一次性迁移，跳过版本仲裁）
  const existing = await loadUserVault(userId);
  if (existing && isLegacyCloudEnvelope(existing.envelope)) {
    const migrated = await migrateUserVault(userId, envelope, version, updatedAt);
    invalidateVaultCache(userId);
    return NextResponse.json({ ok: true, version: migrated.meta.version, migrated: true });
  }
  const res = await pushUserVault(userId, envelope, version, updatedAt);
  if (res.ok) {
    invalidateVaultCache(userId);
    return NextResponse.json({ ok: true, version: res.meta.version, created: res.created });
  }
  return NextResponse.json({ error: "conflict", meta: res.meta }, { status: 409 });
}

export async function DELETE() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await prisma.vaultBackup.deleteMany({ where: { userId } });
  invalidateVaultCache(userId);
  return NextResponse.json({ ok: true });
}