import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/configs/prisma";
import { loadUserVault, pushUserVault, migrateUserVault } from "@/configs/sync-vault";
import { encryptCloud, decryptCloud, isCloudVault, isLegacyCloudEnvelope, type CloudEnvelope } from "@/configs/cloud-vault";
import { getVaultCache, setVaultCache, invalidateVaultCache } from "@/configs/vault-cache";
import { deviceUserId } from "@/app/lib/device-auth";

/**
 * L3 云端统一保险箱：客户端明文透传，服务端用账号密钥（cloudKey）加密落库。
 * 鉴权：x-device-token 请求头 → DeviceToken → userId（首次推送时创建设备注册）。
 * 冲突仲裁仍用严格单调 version（乐观锁）。
 */

const DEVICE_HEADER = "x-device-token";

export async function GET(request: NextRequest) {
  const userId = await deviceUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized device" }, { status: 401 });
  // 命中缓存：免远端库查询与解密（Web 与插件同源共享同一 userId 缓存）
  const cached = getVaultCache(userId);
  if (cached) return NextResponse.json(cached);
  const vault = await loadUserVault(userId);
  if (!vault) {
    return NextResponse.json({ error: "backup not found" }, { status: 404 });
  }
  // 旧版 v1 信封（主密码 E2EE）：服务端无法解密，标记 legacy 让客户端重新推送迁移
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
    console.error("[sync] decrypt cloud failed:", err);
    return NextResponse.json({ error: "cloud decrypt failed" }, { status: 500 });
  }
  const meta = { version: vault.metaVersion, updatedAt: Number(vault.metaUpdatedAt) };
  setVaultCache(userId, cloud, meta);
  return NextResponse.json({ vault: cloud, meta });
}

export async function POST(request: NextRequest) {
  const userId = await deviceUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized device" }, { status: 401 });

  let body: {
    vault?: unknown;
    meta?: { version?: unknown; updatedAt?: unknown };
    deviceName?: unknown;
  };
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

  // 服务端用账号密钥加密后落库（Web 登录即可解密查看）
  const envelope = await encryptCloud(userId, body.vault);

  // 首次推送：注册设备（此时令牌才落库 —— 空设备不推送 → 不写库）
  const token = request.headers.get(DEVICE_HEADER) ?? "";
  await prisma.deviceToken.upsert({
    where: { token },
    create: {
      token,
      userId,
      deviceName: typeof body.deviceName === "string" && body.deviceName ? body.deviceName : "Chrome 扩展",
    },
    update: {},
  });

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

export async function DELETE(request: NextRequest) {
  const userId = await deviceUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized device" }, { status: 401 });
  await prisma.vaultBackup.deleteMany({ where: { userId } });
  invalidateVaultCache(userId);
  return NextResponse.json({ ok: true });
}