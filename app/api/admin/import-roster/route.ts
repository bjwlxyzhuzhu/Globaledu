import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const DOMAIN = "bjwlxy.lab"; // 学号伪邮箱域名（与登录页/seed 一致）

type Row = { student_no?: string; name?: string; class?: string; college?: string; major?: string };

/** 名册批量导入：建/重置学生登录账号（学号@域名 + 统一初始密码）+ 补 profile + upsert rosters。幂等。 */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  let body: { rows?: Row[]; password?: string; credits?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  const rows = Array.isArray(body?.rows) ? body!.rows! : [];
  const password = (body?.password || "").trim();
  const credits = Number.isFinite(body?.credits) ? Math.max(0, Math.floor(body!.credits!)) : 120;
  if (!rows.length) return NextResponse.json({ error: "没有可导入的行" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "初始密码至少 6 位" }, { status: 400 });

  const admin = createAdminClient();
  // 已有用户 email→id 映射（一次拉取，最多 1000；够本平台用）
  const emailToId = new Map<string, string>();
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users || []) if (u.email) emailToId.set(u.email, u.id);
  } catch { /* 拉取失败不致命，按新建处理 */ }

  type R = { student_no: string; name: string; status: "created" | "exists" | "failed"; error?: string };
  const results: R[] = [];
  for (const r of rows) {
    const no = (r.student_no || "").toString().trim();
    const name = (r.name || "").toString().trim();
    const klass = (r.class || "").toString().trim();
    if (!no) { results.push({ student_no: "", name, status: "failed", error: "缺学号" }); continue; }
    const email = `${no}@${DOMAIN}`;
    let id = emailToId.get(email);
    let status: "created" | "exists" = id ? "exists" : "created";
    try {
      if (id) {
        await admin.auth.admin.updateUserById(id, { password });
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
        if (error || !data?.user) {
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          id = list?.users?.find((u) => u.email === email)?.id;
          if (!id) { results.push({ student_no: no, name, status: "failed", error: error?.message || "建号失败" }); continue; }
          status = "exists";
        } else {
          id = data.user.id;
        }
      }
      const { error: pe } = await admin.from("profiles").update({
        student_no: no, name: name || no, class: klass || null, college: r.college || null, major: r.major || null,
        role: "student", credits,
      }).eq("id", id);
      if (pe) { results.push({ student_no: no, name, status: "failed", error: "档案更新失败：" + pe.message }); continue; }
      await admin.from("rosters").upsert(
        { class: klass, student_no: no, name: name || no, college: r.college || null, major: r.major || null },
        { onConflict: "class,student_no" }
      );
      results.push({ student_no: no, name: name || no, status });
    } catch (e) {
      results.push({ student_no: no, name, status: "failed", error: e instanceof Error ? e.message : "未知错误" });
    }
  }

  return NextResponse.json({
    created: results.filter((r) => r.status === "created").length,
    exists: results.filter((r) => r.status === "exists").length,
    failed: results.filter((r) => r.status === "failed").length,
    results, password,
  });
}
