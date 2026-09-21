import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * P4 · 成效面板（教师/管理员）：把参赛说明书第六节"应用成效"的全部待填指标自动算出来。
 * 全部来自真实表聚合；决赛材料截图/复制即可，不需要手工数。
 */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!prof || !["admin", "teacher"].includes(prof.role))
    return NextResponse.json({ error: "无权限" }, { status: 403 });

  const head = { count: "exact" as const, head: true };
  const safe = async (p: PromiseLike<{ count: number | null }>) => {
    try { const { count } = await p; return count || 0; } catch { return 0; }
  };

  const [students, chats, chatUsers, topics, drafts, exportsN, defenses, skills, visits, icards, evRows] = await Promise.all([
    safe(admin.from("profiles").select("id", head).eq("role", "student")),
    safe(admin.from("usage_logs").select("id", head)),
    (async () => { try { const { data } = await admin.from("usage_logs").select("user_id").limit(20000); return new Set((data || []).map((r) => r.user_id)).size; } catch { return 0; } })(),
    safe(admin.from("evidence_events").select("id", head).eq("kind", "topic_match")),
    safe(admin.from("evidence_events").select("id", head).in("kind", ["bp_draft", "crew_final"])),
    safe(admin.from("evidence_events").select("id", head).eq("kind", "export_doc")),
    safe(admin.from("evidence_events").select("id", head).eq("kind", "defense_radar")),
    safe(admin.from("evidence_events").select("id", head).eq("kind", "skill_use")),
    (async () => { try { const { data } = await admin.from("site_visits").select("count"); return (data || []).reduce((s, r) => s + (r.count || 0), 0); } catch { return 0; } })(),
    (async () => {
      try {
        const { data } = await admin.from("intervention_cards").select("status");
        const all = data || [];
        return { total: all.length, responded: all.filter((c) => c.status !== "open" && c.status !== "retracted").length, disputed: all.filter((c) => c.status === "disputed").length };
      } catch { return { total: 0, responded: 0, disputed: 0 }; }
    })(),
    (async () => {
      try {
        const { data } = await admin.from("evidence_events")
          .select("user_id, dims, created_at").eq("kind", "defense_radar")
          .order("created_at", { ascending: true }).limit(5000);
        return data || [];
      } catch { return []; }
    })(),
  ]);

  // 答辩前后测：每位有 ≥2 场答辩的学生，取首场与末场总分求均值
  const byUser = new Map<string, number[]>();
  for (const r of evRows) {
    const total = (r.dims as { total?: number } | null)?.total;
    if (typeof total !== "number") continue;
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(total);
  }
  const pairs = [...byUser.values()].filter((v) => v.length >= 2);
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10 : 0);
  const preAvg = avg(pairs.map((v) => v[0]));
  const postAvg = avg(pairs.map((v) => v[v.length - 1]));

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    coverage: {
      students, activeUsers: chatUsers, chats,
      chatsPerUser: chatUsers ? Math.round((chats / chatUsers) * 10) / 10 : 0,
      visits,
    },
    output: { topics, drafts, exports: exportsN, skills },
    growth: {
      defenses, paired: pairs.length, preAvg, postAvg,
      delta: pairs.length ? Math.round((postAvg - preAvg) * 10) / 10 : 0,
    },
    intervention: {
      total: icards.total, responded: icards.responded, disputed: icards.disputed,
      responseRate: icards.total ? Math.round((icards.responded / icards.total) * 100) : null,
    },
  });
}
