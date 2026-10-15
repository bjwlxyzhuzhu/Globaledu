import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLIENT_KINDS, logEvidence } from "@/lib/evidence";

export const runtime = "nodejs";

/**
 * 成长星图 · 证据事件接口。
 * POST：客户端自报"产出型动作"（导出文档 / 启用技能 / 干预回应）。
 *   身份与时间戳由服务端盖章（user 来自会话、created_at 来自数据库），学生不能替他人或倒填时间存证。
 * GET：读取证据链（学生只能读自己；教师/管理员可用 ?user= 读指定学生，做学情看板与成长报告）。
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { kind?: string; title?: string; payload?: Record<string, unknown>; project?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }

  const kind = (body?.kind || "").trim();
  if (!CLIENT_KINDS.has(kind))
    return NextResponse.json({ error: "不支持的事件类型" }, { status: 400 });

  // payload 限长，防塞爆
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(JSON.stringify(body?.payload || {}).slice(0, 4000)); } catch { payload = {}; }

  await logEvidence({
    userId: user.id, kind, title: body?.title || "",
    payload, projectId: typeof body?.project === "string" ? body.project : null,
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const targetUser = url.searchParams.get("user");
  const kind = url.searchParams.get("kind");
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 200));

  const admin = createAdminClient();
  let uid = user.id;
  if (targetUser && targetUser !== user.id) {
    // 查他人证据链需要教师/管理员身份
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (!prof || !["admin", "teacher"].includes(prof.role))
      return NextResponse.json({ error: "无权查看他人证据链" }, { status: 403 });
    uid = targetUser;
  }

  let q = admin.from("evidence_events")
    .select("id, project_id, kind, title, dims, payload, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data || [] });
}
