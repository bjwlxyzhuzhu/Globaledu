"use client";
import { useState } from "react";
import CoachSession from "./apply/CoachSession";

export type AgentModule = {
  key: string; icon: string; title: string; desc: string; points?: string[];
  system: string; greeting: string; prompts?: string[];
};

/** 「先选一个模块 → 只剩这个模块的对话框(可传附件)」聚焦式智能体。理论/政策等复用。 */
export default function AgentModules({ modules, accent = "#22d3ee", askLabel = "进入对话 →" }: {
  modules: AgentModule[]; accent?: string; askLabel?: string;
}) {
  const [sel, setSel] = useState<AgentModule | null>(null);

  if (sel) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={() => setSel(null)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink)", padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", cursor: "pointer", fontFamily: "inherit" }}>
            ← 换一个
          </button>
          <span style={{ fontSize: 20 }}>{sel.icon}</span>
          <b style={{ fontSize: 16 }}>{sel.title}</b>
          <span style={{ fontSize: 12.5, color: "var(--mut)" }}>{sel.desc}</span>
        </div>
        <CoachSession key={sel.key} system={sel.system} greeting={sel.greeting} accent={accent} multiline
          exportTitle={sel.title} promptTags={sel.prompts} placeholder="输入你的问题，或点 📎 上传资料…" />
      </div>
    );
  }

  return (
    <>
      <p style={{ fontSize: 13, color: "var(--mut)", marginBottom: 16 }}>选一个开始，进入专属对话（可上传附件、连续追问）：</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {modules.map((m) => (
          <div key={m.key} onClick={() => setSel(m)}
            style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)", padding: 18, cursor: "pointer", transition: "transform .15s, border-color .2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = `${accent}88`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "var(--line)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{m.icon}</span>
              <h3 style={{ fontSize: 15.5, fontWeight: 800 }}>{m.title}</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.65, marginBottom: m.points?.length ? 10 : 12 }}>{m.desc}</p>
            {m.points && m.points.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {m.points.map((p, k) => (
                  <span key={k} style={{ fontSize: 11.5, color: accent, border: `1px solid ${accent}55`, borderRadius: 999, padding: "3px 10px" }}>{p}</span>
                ))}
              </div>
            )}
            <span style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>{askLabel}</span>
          </div>
        ))}
      </div>
    </>
  );
}
