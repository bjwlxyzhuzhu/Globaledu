"use client";
import { useState } from "react";
import Link from "next/link";
import LearnChrome from "../../learn/LearnChrome";
import CoachSession from "../CoachSession";
import { TRACKS } from "@/lib/contest";
import { downloadWord } from "@/lib/download";

const ARC =
  "封面(项目名+一句话slogan+队名校名) → 痛点与机会 → 解决方案/产品 → 产品演示(关键截图/流程) → 技术与壁垒 → 市场规模(TAM/SAM/SOM) → 商业模式 → 竞争分析 → 运营与里程碑 → 团队(黄金三角) → 财务预测与融资 → 愿景与结尾";

export default function PptGenPage() {
  const [track, setTrack] = useState(TRACKS[0].track);
  const [draft, setDraft] = useState("");
  const [genState, setGenState] = useState<"idle" | "loading" | "done">("idle");
  const [genErr, setGenErr] = useState("");
  const [result, setResult] = useState<{ downloadUrl?: string; editUrl?: string }>({});
  const t = TRACKS.find((x) => x.track === track);
  const label = t?.full || track;

  async function genPro() {
    if (genState === "loading" || !draft.trim()) return;
    setGenState("loading"); setGenErr(""); setResult({});
    try {
      const res = await fetch("/api/ppt/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, title: `路演 · ${label}`, slides: 12 }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("请先登录（右上角 → 登录）");
      if (res.status === 402) throw new Error(d.error || "积分不足");
      if (res.status === 501) throw new Error((d.error || "PPT 引擎未配置") + " —— 可先用旁边的「轻量导出」。");
      if (!res.ok) throw new Error(d.error || "生成失败 " + res.status);
      setResult({ downloadUrl: d.downloadUrl, editUrl: d.editUrl });
      setGenState("done");
      return;
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "网络错误");
    }
    setGenState("idle");
  }

  const system = `你是“小创”，双创AI星际·创新中心“幻灯生成”路演架构师，性格热情似火。依据《国赛手册》各赛道路演PPT架构与平台收录的官方PPT模板结构，为【${label}】生成一份逐页路演幻灯大纲。要求：①整体参考架构：${ARC}（按该赛道侧重增删）；②每页用「## 第N页 · 标题」开头，下列 3-5 条要点（精炼短句，适合放进幻灯，不要整段），再加一行「🎤讲稿：」给出 30-60 字口播；③信息不足时先问最关键的一项，足够就直接产出；④紧扣【${label}】评分维度，重点页（方案/市场/商业模式/团队）多着墨；⑤默认 12 页左右，可按要求精简。学生上传资料(📎)时据此定制。`;

  const greeting = `我是小创 🔥 来帮你搭「${label}」的路演 PPT。先一句话说说项目（做什么、给谁、解决什么问题），或直接点「生成完整路演大纲」——我按国赛架构逐页给你标题+要点+讲稿，导出后倒进模板宝库里的官方 PPT 模板就行。`;

  const sel: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" };

  return (
    <LearnChrome emoji="🦁" title="幻灯生成 · 路演 PPT" subtitle="依《国赛手册》架构逐页生成「标题+要点+讲稿」· 导出大纲套进官方模板">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "var(--mut)" }}>目标赛事/赛道：</span>
        <select value={track} onChange={(e) => { setTrack(e.target.value); setDraft(""); }} style={sel}>
          {TRACKS.map((x) => <option key={x.track} value={x.track} style={{ background: "#0a0e22" }}>{x.full || (x.alias ? `${x.track}（${x.alias}）` : x.track)}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 14, lineHeight: 1.7 }}>
        生成的是逐页大纲（标题 + 要点 + 讲稿）。需要现成的 PPT 版式，去 <Link href="/learn/templates" style={{ color: "#ff8a5c" }}>模板宝库</Link> 取官方路演模板，把大纲内容填进去即可。
      </p>

      <CoachSession
        key={track}
        accent="#ff6b35"
        multiline
        system={system}
        greeting={greeting}
        placeholder="说说你的项目，或点下方按钮…（Shift+Enter 换行）"
        exportTitle={`幻灯生成 · ${label}`}
        promptTags={["封面页怎么设计更抓人？", "痛点页该放什么内容？", "帮我写第 3 页的讲稿"]}
        quickActions={[
          { label: "🎬 生成完整路演大纲", message: `请为我的项目生成一份完整的路演 PPT 逐页大纲，紧扣【${label}】评分侧重。每页用「## 第N页 · 标题」+ 3-5 条要点 + 一行「🎤讲稿：」口播，默认 12 页左右。` },
          { label: "⚡ 精简到 8 页", message: "请把路演大纲精简到 8 页以内，只保留最能打动评委的核心页。" },
          { label: "🎤 只出讲稿逐字稿", message: "请基于上面的大纲，逐页给出 5 分钟路演的讲稿逐字稿（每页 30-60 字，口语化、有感染力）。" },
        ]}
        onReply={(text) => { if (text && text.trim().length > 40) setDraft(text); }}
      />

      {draft && (
        <div style={{ marginTop: 14, border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={genPro} disabled={genState === "loading"}
              style={{ padding: "10px 18px", borderRadius: 12, border: "none", cursor: genState === "loading" ? "default" : "pointer", fontWeight: 800, color: "#05060f", background: "linear-gradient(120deg,#22d3ee,#7c5cff)", fontFamily: "inherit", fontSize: 13.5, opacity: genState === "loading" ? 0.6 : 1 }}>
              {genState === "loading" ? "⏳ 引擎生成中（约 1-2 分钟）…" : "🎬 一键生成商业级 PPT"}
            </button>
            <button onClick={() => downloadWord(`路演PPT大纲_${t?.track || ""}.doc`, `路演 PPT 大纲 · ${label}`, draft)}
              style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid var(--line)", cursor: "pointer", fontWeight: 700, color: "var(--ink)", background: "rgba(255,255,255,.05)", fontFamily: "inherit", fontSize: 13 }}>
              ⬇ 轻量导出：大纲 Word
            </button>
            <span style={{ fontSize: 12, color: "var(--mut)" }}>商业级 = 开源引擎直出可编辑 PPTX（真版式，非清单页）</span>
          </div>
          {genErr && <p style={{ fontSize: 12.5, color: "#f5a623", marginTop: 10, lineHeight: 1.7 }}>⚠️ {genErr}</p>}
          {genState === "done" && (
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              {result.downloadUrl && (
                <a href={result.downloadUrl} target="_blank" rel="noreferrer"
                  style={{ padding: "9px 16px", borderRadius: 999, fontWeight: 800, fontSize: 13, color: "#05060f", background: "linear-gradient(120deg,#34d399,#22d3ee)", textDecoration: "none" }}>
                  ⬇ 下载 PPTX
                </a>
              )}
              {result.editUrl && (
                <a href={result.editUrl} target="_blank" rel="noreferrer"
                  style={{ padding: "9px 16px", borderRadius: 999, fontWeight: 700, fontSize: 13, color: "var(--cyan)", border: "1px solid rgba(34,211,238,.5)", textDecoration: "none" }}>
                  ✏️ 在线编辑幻灯
                </a>
              )}
              <span style={{ fontSize: 12, color: "var(--mut)", alignSelf: "center" }}>生成完成 ✅ 可下载或继续在线微调</span>
            </div>
          )}
        </div>
      )}
    </LearnChrome>
  );
}
