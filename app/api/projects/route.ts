import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 云端项目（跨设备 / 教师可查）。表未建时优雅降级，提示先跑 0005 迁移。
type Row = { id: string; name: string; draft: string; sections: unknown; team: unknown; updated_at: string };

function missingTable(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === "42P01" || /relation .*projects.* does not exist|could not find the table/i.test(e.message || ""));
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const supabase = createClient();
  if (id) {
    const { data, error } = await supabase.from("projects").select("id,name,draft,sections,team,updated_at").eq("id", id).maybeSingle();
    if (error) { if (missingTable(error)) return NextResponse.json({ needMigration: true, project: null }); return NextResponse.json({ error: error.message }, { status: 500 }); }
    return NextResponse.json({ project: data || null });
  }
  const { data, error } = await supabase.from("projects").select("id,name,updated_at").order("updated_at", { ascending: false }).limit(50);
  if (error) { if (missingTable(error)) return NextResponse.json({ needMigration: true, items: [] }); return NextResponse.json({ error: error.message }, { status: 500 }); }
  return NextResponse.json({ items: (data || []) as Pick<Row, "id" | "name" | "updated_at">[] });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: { id?: string; name?: string; draft?: string; sections?: unknown; team?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  const payload = {
    user_id: user.id,
    name: (body.name || "我的项目").toString().slice(0, 120),
    draft: (body.draft || "").toString().slice(0, 200000),
    sections: body.sections && typeof body.sections === "object" ? body.sections : {},
    team: Array.isArray(body.team) ? body.team : [],
  };
  const supabase = createClient();
  if (body.id) {
    const { data, error } = await supabase.from("projects").update(payload).eq("id", body.id).select("id").maybeSingle();
    if (error) { if (missingTable(error)) return NextResponse.json({ error: "云端存储未启用：请先在 Supabase 运行 0005_projects 迁移", needMigration: true }, { status: 400 }); return NextResponse.json({ error: error.message }, { status: 500 }); }
    return NextResponse.json({ id: data?.id || body.id });
  }
  const { data, error } = await supabase.from("projects").insert(payload).select("id").maybeSingle();
  if (error) { if (missingTable(error)) return NextResponse.json({ error: "云端存储未启用：请先在 Supabase 运行 0005_projects 迁移", needMigration: true }, { status: 400 }); return NextResponse.json({ error: error.message }, { status: 500 }); }
  return NextResponse.json({ id: data?.id });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) { if (missingTable(error)) return NextResponse.json({ error: "云端存储未启用", needMigration: true }, { status: 400 }); return NextResponse.json({ error: error.message }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
