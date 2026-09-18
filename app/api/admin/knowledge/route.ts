import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** 知识库统计（service-role，knowledge 无客户端读策略）：按 source 分组计数 + cases/templates 总数。 */
export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  const admin = createAdminClient();

  // 分页拉 source 列做分组计数（不受单次 1000 行上限影响）
  const bySource = new Map<string, number>();
  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("knowledge").select("source").range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data as { source: string }[]) || [];
    for (const r of batch) { const s = r.source || "(无来源)"; bySource.set(s, (bySource.get(s) || 0) + 1); }
    total += batch.length;
    if (batch.length < 1000) break;
  }
  const sources = [...bySource.entries()].map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n);

  const [casesRes, tplRes] = await Promise.all([
    admin.from("cases").select("id", { count: "exact", head: true }),
    admin.from("templates").select("id", { count: "exact", head: true }),
  ]);
  return NextResponse.json({ knowledge: total, sources, cases: casesRes.count || 0, templates: tplRes.count || 0 });
}

/** 按来源删除知识块（service-role）。 */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  let body: { op?: string; source?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  if (body.op !== "delete-source" || !body.source) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const admin = createAdminClient();
  const { error, count } = await admin.from("knowledge").delete({ count: "exact" }).eq("source", body.source);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count || 0 });
}
