import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/** 查当前用户积分（首页/客户端刷新用） */
export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({
    credits: profile.credits,
    name: profile.name,
    role: profile.role,
  });
}
