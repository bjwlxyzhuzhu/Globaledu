import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** 学生管理操作（service-role）：op=credits 设积分 / op=role 改角色 / op=password 重置密码。 */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  let body: { op?: string; user_id?: string; value?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  const { op, user_id } = body;
  if (!user_id) return NextResponse.json({ error: "缺 user_id" }, { status: 400 });
  const admin = createAdminClient();

  try {
    if (op === "credits") {
      const v = Math.floor(Number(body.value));
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "积分值无效" }, { status: 400 });
      const { error } = await admin.from("profiles").update({ credits: v }).eq("id", user_id);
      if (error) throw error;
      return NextResponse.json({ ok: true, credits: v });
    }
    if (op === "role") {
      const v = String(body.value);
      if (!["student", "teacher", "admin"].includes(v)) return NextResponse.json({ error: "角色无效" }, { status: 400 });
      if (user_id === me.id && !["admin", "teacher"].includes(v)) return NextResponse.json({ error: "不能把自己降级" }, { status: 400 });
      const { error } = await admin.from("profiles").update({ role: v }).eq("id", user_id);
      if (error) throw error;
      return NextResponse.json({ ok: true, role: v });
    }
    if (op === "password") {
      const v = String(body.value || "");
      if (v.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
      const { error } = await admin.auth.admin.updateUserById(user_id, { password: v });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "操作失败" }, { status: 500 });
  }
}
