import "server-only";
// 教师干预闭环（P2）· 检测引擎 + 猫头鹰督导卡片生成。
// 实时触发：学生打开成长星图时对其证据链做一次快速体检（纯读库，毫秒级）；
// 命中规则且 7 天内未发过同规则卡 → 调用平台模型生成四段式卡片落库（不扣学生积分）。
// 硬约束：反谄媚（禁止表扬垫场）、对事不对人（只评产出证据，不评人格特质）、必配可执行方案。
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { apimart } from "@/lib/ai/apimart";
import { MODELS } from "@/lib/ai/models";

type EvRow = {
  id: number; kind: string; title: string;
  dims: { key?: string; axes: { dim: string; score: number; max: number }[]; total: number } | null;
  created_at: string;
};

export type Candidate = {
  rule: string;
  fact: string;                 // 给模型看的客观事实（也是模板兜底的"证据"段）
  linkHref: string; linkLabel: string;
  fallbackSharp: string; fallbackAdvice: string;
};

/** 弱项维度 → 平台内"去哪练"深链 */
function dimLink(dim: string): { href: string; label: string } {
  if (/创新|亮点/.test(dim)) return { href: "/apply/expert", label: "去「专家打磨」提炼亮点" };
  if (/产业|商业|市场|前景|价值/.test(dim)) return { href: "/apply/cockpit", label: "去驾驶舱找商业咨询搭子补强" };
  if (/团队|协作/.test(dim)) return { href: "/apply/cockpit", label: "去驾驶舱梳理团队分工" };
  return { href: "/apply/defense", label: "再打一场针对性模拟答辩" };
}

const ratio = (a: { score: number; max: number }) => (a.max ? a.score / a.max : 0);
const lowestDim = (d: EvRow) => {
  const axes = d.dims?.axes || [];
  if (!axes.length) return null;
  return axes.reduce((m, a) => (ratio(a) < ratio(m) ? a : m), axes[0]);
};

/** 对一条证据链跑规则，产出候选卡（最多 2 张，避免轰炸） */
export function runRules(events: EvRow[]): Candidate[] {
  const out: Candidate[] = [];
  const defenses = events.filter((e) => e.kind === "defense_radar" && e.dims?.axes?.length);
  const n = defenses.length;

  // R1 弱项连击：最近两次答辩，同一维度都是全场最低
  if (n >= 2) {
    const a = lowestDim(defenses[n - 2]), b = lowestDim(defenses[n - 1]);
    if (a && b && a.dim === b.dim) {
      const l = dimLink(b.dim);
      out.push({
        rule: `dim_streak:${b.dim}`,
        fact: `最近两次模拟答辩（${new Date(defenses[n - 2].created_at).toLocaleDateString("zh-CN")} 与 ${new Date(defenses[n - 1].created_at).toLocaleDateString("zh-CN")}），「${b.dim}」维度都是全场最低（最近一次 ${b.score}/${b.max}）。`,
        linkHref: l.href, linkLabel: l.label,
        fallbackSharp: `「${b.dim}」已经连续两场垫底，这不是失误，是短板。`,
        fallbackAdvice: `把「${b.dim}」单独拎出来：对照评分细则写出 3 条它到底考什么，逐条检查你的材料里有没有对应内容，缺哪条补哪条，然后再打一场只围绕它追问的答辩。`,
      });
    }
  }

  // R2 维度暴跌：最近两次答辩同一维度得分率下滑 ≥ 15 个百分点
  if (n >= 2) {
    const prev = defenses[n - 2].dims!.axes, cur = defenses[n - 1].dims!.axes;
    for (const c of cur) {
      const p = prev.find((x) => x.dim === c.dim);
      if (p && ratio(p) - ratio(c) >= 0.15) {
        const l = dimLink(c.dim);
        out.push({
          rule: `dim_drop:${c.dim}`,
          fact: `「${c.dim}」从上一场的 ${p.score}/${p.max} 跌到这一场的 ${c.score}/${c.max}，得分率下滑超过 15 个百分点。`,
          linkHref: l.href, linkLabel: l.label,
          fallbackSharp: `「${c.dim}」这场明显失守，答辩记录里能找到具体是哪个问题没接住。`,
          fallbackAdvice: `回放这场答辩记录，找到「${c.dim}」相关的那几问，把当时的回答和上一场对比，写出 3 句更有力的应答，下一场专门验证。`,
        });
        break; // 每次最多报一个暴跌维度
      }
    }
  }

  // R3 成稿未答辩：有 BP 成稿（bp_draft/crew_final）但从未打过模拟答辩
  const hasDraft = events.some((e) => e.kind === "bp_draft" || e.kind === "crew_final");
  if (hasDraft && n === 0) {
    out.push({
      rule: "bp_no_defense",
      fact: `已有商业计划书成稿，但一场模拟答辩都没有打过——材料还没有经受过评委式追问的检验。`,
      linkHref: "/apply/defense", linkLabel: "现在就去打第一场模拟答辩",
      fallbackSharp: "稿子写完不等于项目能站住，没被追问过的 BP 只是作文。",
      fallbackAdvice: "带着你的 BP 去打一场模拟答辩，重点听评委 Agent 追问哪里——被问倒的地方就是下一轮修改的清单。",
    });
  }

  return out.slice(0, 2);
}

const OWL_SYSTEM = `你是「夜枭督导」🦉——一位驻场的资深创赛评审督导，眼毒、嘴利、心热。你的任务：根据给出的【客观事实】为学生写一张干预卡片。
硬约束（违反即失败）：
1. 反谄媚：禁止任何表扬、鼓励性垫场（如"你已经很棒了，但是…"），第一句就切中要害；
2. 对事不对人：只评价产出与证据（材料、得分、行为记录），绝不评价人格与能力标签（禁止"你不够认真/你能力弱"这类话）；
3. 指出问题必须给出可执行方案：动作要具体到"做什么、做到什么程度"；
4. 语言犀利但克制，单句短促有力，可有一点冷幽默，不许人身攻击、不许阴阳怪气。
只输出 JSON（不要代码块标记）：{"sharp":"一针见血，≤40字","evidence":"用学生听得懂的话复述证据，≤60字","advice":"怎么改，2-3个具体动作，≤120字"}`;

async function owlWrite(fact: string): Promise<{ sharp: string; evidence: string; advice: string } | null> {
  try {
    const base = process.env.CHAT_BASE_URL, key = process.env.CHAT_API_KEY;
    const client = base && key ? new OpenAI({ baseURL: base, apiKey: key }) : apimart;
    const res = await client.chat.completions.create({
      model: MODELS.chat,
      messages: [
        { role: "system", content: OWL_SYSTEM },
        { role: "user", content: `【客观事实】${fact}` },
      ],
      max_tokens: 400,
    });
    const raw = (res.choices[0]?.message?.content || "").replace(/```json|```/g, "").trim();
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    if (typeof j.sharp === "string" && typeof j.advice === "string") {
      return { sharp: j.sharp.slice(0, 80), evidence: (j.evidence || "").slice(0, 140), advice: j.advice.slice(0, 300) };
    }
    return null;
  } catch { return null; }
}

/** 学生打开星图时的"实时体检"：跑规则 → 去重 → 生成并落库新卡。失败不致命。 */
export async function detectAndGenerate(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: events } = await admin
      .from("evidence_events")
      .select("id, kind, title, dims, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (!events?.length) return;

    const candidates = runRules(events as EvRow[]);
    if (!candidates.length) return;

    // 去重：同规则 7 天内已发过（无论学生是否已回应）就不再发
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: recent } = await admin
      .from("intervention_cards")
      .select("rule, status, created_at")
      .eq("user_id", userId)
      .or(`status.eq.open,created_at.gte.${since}`);
    const seen = new Set((recent || []).map((r) => r.rule));

    for (const c of candidates) {
      if (seen.has(c.rule)) continue;
      const owl = await owlWrite(c.fact);
      await admin.from("intervention_cards").insert({
        user_id: userId, rule: c.rule,
        sharp: owl?.sharp || c.fallbackSharp,
        evidence: owl?.evidence || c.fact,
        advice: owl?.advice || c.fallbackAdvice,
        link_href: c.linkHref, link_label: c.linkLabel,
      });
    }
  } catch { /* 体检失败静默：不影响星图加载 */ }
}
