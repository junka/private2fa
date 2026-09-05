import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/configs/nextauth";
import { prisma } from "@/configs/prisma";
import { randomBytes } from "crypto";
import { putPending } from "../pending-store";

/**
 * OAuth 式自动连接（polling 版）：
 * Chrome 禁掉 Web 页顶层跳转到 chrome-extension://，令牌无法随 URL 回跳；
 * 改为：扩展生成随机 cid → 打开 /connect?extid&cid → 本接口在 Web 已登录时
 * 为扩展注册设备令牌（同一用户仅一条，重复连接复用），按 cid 暂存 →
 * 扩展后台轮询 /api/device-token/pending?cid 领取并自动保存。
 * 只注册设备身份（不产生空备份）；保险箱 VaultBackup 首次真实推送时才创建。
 */
const EXT_ID_RE = /^[a-p]{32}$/;
const CID_RE = /^[a-f0-9]{16,64}$/;
const DEVICE_NAME = "Chrome 扩展";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const extid = request.nextUrl.searchParams.get("extid") ?? "";
  const cid = request.nextUrl.searchParams.get("cid") ?? "";
  if (!EXT_ID_RE.test(extid) || !CID_RE.test(cid)) {
    return NextResponse.json({ error: "invalid extid or cid" }, { status: 400 });
  }

  // 同一用户同一规格名唯一：重复连接不产生新行/新令牌，避免空令牌堆积
  const device = await prisma.deviceToken.upsert({
    where: { userId_deviceName: { userId: session.user.id, deviceName: DEVICE_NAME } },
    create: { token: randomBytes(24).toString("hex"), userId: session.user.id, deviceName: DEVICE_NAME },
    update: {},
  });

  // 展示名 = 网页用户名（无" · Chrome 扩展"后缀）
  const name = session.user.name ?? "user";

  putPending(cid, device.token, name);
  return NextResponse.json({ ok: true, token: device.token, name });
}