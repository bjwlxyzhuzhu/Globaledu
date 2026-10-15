// 成长星图 · 证据事件层（服务端）。
// 各模块的"里程碑产出"由服务端盖章写入 evidence_events（service_role，学生端无法伪造）。
// 不是每条消息都存：每类事件有"里程碑门槛"（gate），只有达到门槛的产出才成为星图上的一颗星。
import { createAdminClient } from "@/lib/supabase/admin";

/** 允许经 /api/ai/ask 存证的事件类型 → 里程碑门槛（AI 回复须满足才落库） */
export const ASK_GATES: Record<string, (reply: string) => boolean> = {
  // 答辩打分：回复里出现 SCORES 行（评委 Agent 按官方维度打分）才算一次雷达
  defense_radar: (t) => /SCORES[:：]/.test(t),
  // 选题结论：出现"推荐/建议 + 赛道/组别/赛事"的成型建议
  topic_match: (t) => /(推荐|建议)/.test(t) && /(赛道|组别|赛事)/.test(t),
  // 专家打磨：一次有实质内容的审稿
  expert_review: (t) => t.trim().length >= 300,
  // BP 成稿：分节的长文（Markdown ## 标题 + 篇幅）
  bp_draft: (t) => t.trim().length >= 800 && /##\s/.test(t),
  // 驾驶舱总负责成稿（P1 接线）
  crew_final: (t) => t.trim().length >= 800,
};

/** 允许客户端经 /api/evidence 自报的事件类型（产出型动作，本身即产物引用） */
export const CLIENT_KINDS = new Set(["export_doc", "skill_use", "intervention_response"]);

export type RadarDims = { key: string; axes: { dim: string; score: number; max: number }[]; total: number };

/** 从答辩回复解析 SCORES 行 → 五维快照（与 defense 页客户端解析逻辑一致） */
export function parseRadar(reply: string, rubric?: { dim: string; w: number }[]): RadarDims | null {
  const m = reply.match(/SCORES[:：]\s*([^\n]+)/);
  if (!m) return null;
  const map: Record<string, number> = {};
  for (const p of m[1].split(/[，,、]/)) {
    const mm = p.match(/(.+?)\s*[=＝:：]\s*(\d+)/);
    if (mm) map[mm[1].trim()] = parseInt(mm[2], 10);
  }
  const dims = rubric?.length ? rubric : Object.keys(map).map((dim) => ({ dim, w: 100 }));
  const axes = dims.map((d) => ({ dim: d.dim, score: Math.min(map[d.dim] ?? 0, d.w), max: d.w }));
  if (!axes.some((a) => a.score > 0)) return null;
  return { key: "", axes, total: axes.reduce((s, a) => s + a.score, 0) };
}

/** 写入一条证据事件（失败不致命：存证绝不阻塞正常功能） */
export async function logEvidence(ev: {
  userId: string; kind: string; title?: string;
  dims?: RadarDims | null; payload?: Record<string, unknown>; projectId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("evidence_events").insert({
      user_id: ev.userId,
      project_id: ev.projectId || null,
      kind: ev.kind,
      title: (ev.title || "").slice(0, 120),
      dims: ev.dims || null,
      payload: ev.payload || {},
    });
  } catch { /* 存证失败静默：不影响主流程 */ }
}

/** 截取回放摘录（星图上点开一颗星时看到的产物片段） */
export function excerpt(s: string, n = 800): string {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}
