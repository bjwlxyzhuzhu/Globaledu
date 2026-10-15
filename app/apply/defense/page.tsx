"use client";
import { useEffect, useMemo, useState } from "react";
import LearnChrome from "../../learn/LearnChrome";
import CoachSession from "../CoachSession";
import RadarChart from "../RadarChart";
import { TRACKS, RUBRICS, groupKey } from "@/lib/contest";

export default function DefensePage() {
  const [track, setTrack] = useState(TRACKS[0].track);
  const groups = useMemo(() => TRACKS.find((t) => t.track === track)?.groups || [], [track]);
  const [group, setGroup] = useState(groups[0]);
  useEffect(() => { setGroup(groups[0]); }, [groups]);

  const key = groupKey(track, group);
  const rubric = RUBRICS[key] || [];
  const [scored, setScored] = useState<{ axes: { label: string; score: number; max: number }[]; total: number } | null>(null);
  useEffect(() => { setScored(null); }, [key]);

  const dimsList = rubric.map((d) => `${d.dim}(满分${d.w})`).join("、");
  const SYSTEM = `你是“小创”，国赛模拟答辩的评委 Agent。本次赛道组别为【${key}】，官方评分维度：${dimsList}。请严格扮演评委：每轮【只提一个】尖锐、有深度的问题（参考《国赛手册》答辩题库，覆盖核心问题/技术产品/市场竞争/商业模式/财务/团队/社会价值等），学生回答后用 1-2 句犀利但建设性的点评（点出亮点或漏洞），再追问下一个问题。当学生明确要求“打分”时，才按维度打分。`;
  const greeting = `【模拟答辩开始 · ${key}】你好，我是评委小创 🔥。先请用一分钟介绍你们的项目：你们解决了什么核心问题？为什么重要？`;
  const scorePrompt = `请结束本轮模拟答辩，依据【${key}】的官方评分维度为我的整体表现打分。先用 2-3 句总评（亮点 + 主要失分点），然后在【最后单独一行】用如下精确格式输出各维度得分（整数，不超过该维度满分）：\nSCORES: ${rubric.map((d) => `${d.dim}=分数`).join(", ")}\n（各维度满分：${rubric.map((d) => `${d.dim} ${d.w}`).join("、")}）`;

  function onReply(text: string) {
    const m = text.match(/SCORES[:：]\s*([^\n]+)/);
    if (!m) return;
    const map: Record<string, number> = {};
    for (const p of m[1].split(/[，,、]/)) {
      const mm = p.match(/(.+?)\s*[=＝:：]\s*(\d+)/);
      if (mm) map[mm[1].trim()] = parseInt(mm[2], 10);
    }
    const axes = rubric.map((d) => ({ label: d.dim, score: Math.min(map[d.dim] ?? 0, d.w), max: d.w }));
    setScored({ axes, total: axes.reduce((s, a) => s + a.score, 0) });
  }

  const sel: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" };

  return (
    <LearnChrome emoji="🐺" title="模拟路演答辩" subtitle="评委 Agent 连环追问 · 按官方维度打分（雷达图）">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--mut)" }}>选择赛道组别：</span>
        <select value={track} onChange={(e) => setTrack(e.target.value)} style={sel}>
          {TRACKS.map((t) => <option key={t.track} value={t.track} style={{ background: "#0a0e22" }}>{t.full || (t.alias ? `${t.track}（${t.alias}）` : t.track)}</option>)}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value)} style={sel}>
          {groups.map((g) => <option key={g} value={g} style={{ background: "#0a0e22" }}>{g}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--mut)" }}>评分维度：{rubric.map((d) => `${d.dim}${d.w}`).join(" / ")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: scored ? "1fr 320px" : "1fr", gap: 18, alignItems: "start" }}>
        <CoachSession
          key={key}
          system={SYSTEM}
          greeting={greeting}
          placeholder="回答评委的问题…"
          exportTitle={`模拟答辩 · ${key}`}
          promptTags={["可以开始向我提问了", "帮我多问商业模式方面的问题", "我刚才的回答有什么漏洞？"]}
          quickActions={[{ label: "🏁 结束并打分", message: scorePrompt }]}
          onReply={onReply}
          evidence={{ kind: "defense_radar", title: `模拟答辩 · ${key}`, meta: { key }, rubric }}
        />
        {scored && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 16 }}>
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>综合得分</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#ff6b35" }}>{scored.total}<span style={{ fontSize: 14, color: "var(--mut)" }}> / 100</span></div>
            </div>
            <RadarChart axes={scored.axes} />
          </div>
        )}
      </div>
    </LearnChrome>
  );
}
