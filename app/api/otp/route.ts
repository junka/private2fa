import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/configs/nextauth";
import { findAllOtps } from "@/configs/prisma";

/**
 * 遗留只读接口（一次性迁移用）：返回 optsecret 明文列表。
 * 统一云端保险箱后不再提供写入；Web 首次建库时由此迁移旧数据。
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const otps = await findAllOtps();
  return NextResponse.json({ otps });
}