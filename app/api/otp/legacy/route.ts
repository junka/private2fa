import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/configs/prisma";
import { deviceUserId } from "@/app/lib/device-auth";

/**
 * 设备令牌领取网页端遗留 OTP 明文（optsecret，旧网页时代数据），一次性迁移。
 * Web 端不再展示密钥，遗留数据由插件用本地主密码加密后入保险库；领取即删。
 * 明文下发的边界：只有该账号拥有的设备（deviceToken 鉴权）可取，与 /api/sync 同权。
 */
export async function GET(request: NextRequest) {
  const userId = await deviceUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized device" }, { status: 401 });

  const legacy = await prisma.optsecret.findMany({ orderBy: { id: "asc" } });
  if (legacy.length > 0) {
    await prisma.optsecret.deleteMany({});
  }

  return NextResponse.json({
    otps: legacy.map((o) => ({
      label: o.label,
      secret: o.secret,
      algorithm: o.algorithm,
      issuer: o.issuer,
      period: o.period,
      digits: o.digits,
    })),
  });
}