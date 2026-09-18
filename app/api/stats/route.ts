import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * P4 · 首页实时动态墙（公开，无需登录）。
 * GET：平台累计数字 + 最近里程碑动态（学生姓名脱敏为"某同学"，不含学号）。
 *   数据全部来自真实表（site_visits / profiles / usage_logs / evidence_events）。
 *   若平台尚无真实动态且设置了 WALL_DEMO=1，返回带 demo:true 标记的示例条目
 *  （前端会明确标注"演示数据"，正式评审前置空该变量即可）。
 * POST：访问计数 +1（按天，服务端写入）。
 */

const KIND_TEXT: Record<string, (t: string, total?: number) => string> = {
  defense_radar: (_t, total) => `完成一场模拟答辩${typeof total === "number" && total > 0 ? ` · 得分 ${total}` : ""}`,
  bp_draft: () => "生成了商业计划书草稿",
  crew_final: () => "驾驶舱全员协作打磨出成稿",
  expert_review: () => "接受了专家团审稿打磨",
  topic_match: () => "锁定了参赛赛道",
  export_doc: () => "导出了参赛文档",
  skill_use: () => "点亮了一个新技能",
  intervention_response: () => "回应了夜枭督导的挑战",
};

const DEMO_FEED = [
  "刘同学 完成一场模拟答辩 · 得分 78", "陈同学 生成了商业计划书草稿", "王同学 锁定了参赛赛道",
  "李同学 驾驶舱全员协作打磨出成稿", "张同学 点亮了一个新技能", "赵同学 导出了参赛文档",
  "孙同学 回应了夜枭督导的挑战", "周同学 完成一场模拟答辩 · 得分 82",
];

function mask(name: string | null): string {
  const n = (name || "").trim();
  return n ? n[0] + "同学" : "某同学";
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "刚刚";
  if (s < 3600) return Math.round(s / 60) + " 分钟前";
  if (s < 86400) return Math.round(s / 3600) + " 小时前";
  return Math.round(s / 86400) + " 天前";
}

// 30 秒内存缓存，避免首页流量打穿数据库
let cache: { ts: number; body: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.ts < 30000) return NextResponse.json(cache.body);
  const admin = createAdminClient();

  const safeCount = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    try { const { count } = await q; return count || 0; } catch { return 0; }
  };

  const [visits, students, chats, docs, events] = await Promise.all([
    (async () => { try { const { data } = await admin.from("site_visits").select("count"); return (data || []).reduce((s, r) => s + (r.count || 0), 0); } catch { return 0; } })(),
    safeCount(admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student")),
    safeCount(admin.from("usage_logs").select("id", { count: "exact", head: true })),
    safeCount(admin.from("evidence_events").select("id", { count: "exact", head: true }).in("kind", ["export_doc", "bp_draft", "crew_final"])),
    (async () => {
      try {
        const { data } = await admin.from("evidence_events")
          .select("user_id, kind, dims, created_at")
          .order("created_at", { ascending: false }).limit(24);
        return data || [];
      } catch { return []; }
    })(),
  ]);

  // 姓名脱敏拼动态
  let feed: { text: string; time: string }[] = [];
  if (events.length) {
    const ids = [...new Set(events.map((e) => e.user_id))];
    let names: Record<string, string | null> = {};
    try {
      const { data: profs } = await admin.from("profiles").select("id, name").in("id", ids);
      names = Object.fromEntries((profs || []).map((p) => [p.id, p.name]));
    } catch { /* 名字取不到就全用"某同学" */ }
    feed = events
      .filter((e) => KIND_TEXT[e.kind])
      .map((e) => ({
        text: `${mask(names[e.user_id])} ${KIND_TEXT[e.kind](e.kind, (e.dims as { total?: number } | null)?.total)}`,
        time: ago(e.created_at),
      }));
  }

  let demo = false;
  if (!feed.length && process.env.WALL_DEMO === "1") {
    demo = true;
    feed = DEMO_FEED.map((text, i) => ({ text, time: `${(i + 1) * 7} 分钟前` }));
  }

  const body = { visits, students, chats, docs, feed, demo };
  cache = { ts: Date.now(), body };
  return NextResponse.json(body);
}

export async function POST() {
  try {
    const admin = createAdminClient();
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await admin.from("site_visits").select("count").eq("day", day).maybeSingle();
    if (data) await admin.from("site_visits").update({ count: (data.count || 0) + 1 }).eq("day", day);
    else await admin.from("site_visits").insert({ day, count: 1 });
  } catch { /* 表未建或写失败：静默 */ }
  return NextResponse.json({ ok: true });
}
