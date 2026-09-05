import { NextRequest, NextResponse } from "next/server";
import { takePending } from "../pending-store";

/**
 * 扩展后台领取刚创建的设备令牌：按一次性 cid 领取（领取即删除）。
 * 仅扩展（持有 cid）可调用；cid 由扩展生成、嵌入 /connect 打开的 URL 中，属能力令牌。
 */
const CID_RE = /^[a-f0-9]{16,64}$/;

export async function GET(request: NextRequest) {
  const cid = request.nextUrl.searchParams.get("cid") ?? "";
  if (!CID_RE.test(cid)) {
    return NextResponse.json({ error: "invalid cid" }, { status: 400 });
  }
  const p = takePending(cid);
  if (!p) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, token: p.token, name: p.name });
}