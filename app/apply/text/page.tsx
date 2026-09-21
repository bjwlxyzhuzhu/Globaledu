"use client";
import { useState } from "react";
import LearnChrome from "../../learn/LearnChrome";
import CoachSession from "../CoachSession";
import { TRACKS } from "@/lib/contest";
import { downloadWord } from "@/lib/download";
import { logClientEvidence } from "@/lib/evidenceClient";

const TEN =
  "①封面与项目名 ②执行摘要 ③产品/服务与技术 ④行业与市场分析（含 TAM/SAM/SOM）⑤商业模式（画布九要素）⑥营销与运营 ⑦竞争分析与壁垒 ⑧团队与股权结构 ⑨财务预测（三年）与融资需求 ⑩里程碑、风险与对策";

export default function TextGenPage() {
  const [track, setTrack] = useState(TRACKS[0].track);
  const [draft, setDraft] = useState("");
  const t = TRACKS.find((x) => x.track === track);
  const label = t?.full || track;

  const system = `你是“小创”，双创AI星际·创新中心“文本生成”写作教练，性格热情似火。依据《国赛手册》的商业计划书十节结构，帮学生撰写专业、可参赛的项目文本。当前目标赛事/赛道：【${label}】。十节结构：${TEN}。要求：①若关键信息（项目做什么、给谁、解决什么痛点、团队构成、当前进展）还不够，先用一两句问清最缺的一项，信息够就直接动笔；②输出用 Markdown，分节用「## 一、…」编号，条理清晰；缺数据处用【此处填：…】占位，方便学生替换；③紧扣【${label}】的官方评分侧重；④篇幅充实、逻辑闭环，不灌水。学生上传资料(📎)时据此改写或补全。`;

  const greeting = `我是小创 🔥 来帮你写「${label}」的参赛文本。把项目一句话告诉我（做什么、给谁、解决什么问题），或直接点下方「生成完整商业计划书」——我按国赛十节结构起草，写完点「导出 Word」就能拿走继续改。`;

  const sel: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" };

  return (
    <LearnChrome emoji="🦅" title="文本生成 · 商业计划书" subtitle="依《国赛手册》十节结构 AI 起草 · 一键导出 Word（草稿，可继续编辑）">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "var(--mut)" }}>目标赛事/赛道：</span>
        <select value={track} onChange={(e) => { setTrack(e.target.value); setDraft(""); }} style={sel}>
          {TRACKS.map((x) => <option key={x.track} value={x.track} style={{ background: "#0a0e22" }}>{x.full || (x.alias ? `${x.track}（${x.alias}）` : x.track)}</option>)}
        </select>
      </div>

      <CoachSession
        key={track}
        accent="#ff6b35"
        multiline
        system={system}
        greeting={greeting}
        placeholder="说说你的项目，或点下方按钮…（Shift+Enter 换行）"
        exportTitle={`文本生成 · ${label}`}
        evidence={{ kind: "bp_draft", title: `商业计划书 · ${label}`, meta: { track } }}
        promptTags={["先帮我列个商业计划书提纲", "市场分析这一节怎么写？", "帮我把执行摘要改得更有冲击力"]}
        quickActions={[
          { label: "📄 生成完整商业计划书", message: `请按国赛商业计划书十节结构，为我的项目生成一份完整、专业的商业计划书初稿，紧扣【${label}】的评分侧重。用 Markdown 分节编号（## 一、…）输出，缺数据处用【此处填：…】占位。` },
          { label: "✍️ 只写执行摘要", message: "请先只写一页纸的「执行摘要」，突出痛点、解决方案、核心亮点、团队与融资需求，控制在 400 字内。" },
          { label: "🔁 按此赛道调侧重", message: `请把刚才的内容按【${label}】的官方评分维度，重新调整各节的详略与表达侧重。` },
        ]}
        onReply={(text) => { if (text && text.trim().length > 40) setDraft(text); }}
      />

      {draft && (
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => { downloadWord(`商业计划书_${t?.track || ""}.doc`, `商业计划书 · ${label}`, draft); logClientEvidence("export_doc", { title: `商业计划书 · ${label}`, payload: { fmt: "word", chars: draft.length } }); }}
            style={{ padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, color: "#05060f", background: "linear-gradient(120deg,#ff6b35,#ffb657)", fontFamily: "inherit", fontSize: 13.5 }}>
            ⬇ 把最新内容导出 Word
          </button>
          <span style={{ fontSize: 12, color: "var(--mut)" }}>导出的是草稿，建议自己再核对数据、替换占位再上交</span>
        </div>
      )}
    </LearnChrome>
  );
}
