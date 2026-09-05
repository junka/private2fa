import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/configs/prisma";

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-device-token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const device = await prisma.deviceToken.findUnique({
    where: { token },
    include: { user: { select: { name: true } } },
  });
  // 首次推送前设备仅存在于 pending（进程内），查不到属预期 → 提示激活
  if (!device) return NextResponse.json({ error: "invalid token" }, { status: 404 });

  return NextResponse.json({ ok: true, name: device.user.name ?? "已连接设备" });
}