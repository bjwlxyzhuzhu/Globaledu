"use client";
import { useState } from "react";

export type AskItem = { icon: string; title: string; desc: string; points?: string[]; ask: string };

/** 卡片网格 + 内联 AI 答（接 /api/ai/ask，自动用知识库检索增强）。理论/政策两页共用。 */
export default function LearnAsk({ items, askLabel, system }: { items: AskItem[]; askLabel: string; system: string }) {
  const [ai, setAi] = useState<Record<number, { loading: boolean; text: string }>>({});

  async function ask(i: number, item: AskItem) {
    setAi((s) => ({ ...s, [i]: { loading: true, text: "" } }));
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: item.ask }], system }),
      });
      const data = await res.json().catch(() => ({}));
      let text: string;
      if (res.status === 401) text = "请先登录后再用（右上角 → 登录）。";
      else if (res.status === 402) text = "积分不足～可在账户中心绑定自己的 API Key（不扣积分）。";
      else if (!res.ok) text = "出错了：" + (data.error || res.status);
      else {
        text = data.text || "(空回复)";
        const srcs: { title?: string; source?: string }[] = Array.isArray(data.sources) ? data.sources : [];
        const names = [...new Set(srcs.map((s) => s.title || s.source).filter(Boolean))].slice(0, 3);
        if (names.length) text += `\n\n📚 参考：${names.join("、")}`;
      }
      setAi((s) => ({ ...s, [i]: { loading: false, text } }));
    } catch {
      setAi((s) => ({ ...s, [i]: { loading: false, text: "网络错误，请重试。" } }));
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
      {items.map((it, i) => {
        const a = ai[i];
        return (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)", padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{it.icon}</span>
              <h3 style={{ fontSize: 15.5, fontWeight: 800 }}>{it.title}</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.65, marginBottom: it.points?.length ? 10 : 14 }}>{it.desc}</p>
            {it.points && it.points.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {it.points.map((p, k) => (
                  <span key={k} style={{ fontSize: 11.5, color: "var(--cyan)", border: "1px solid rgba(34,211,238,.35)", borderRadius: 999, padding: "3px 10px" }}>{p}</span>
                ))}
              </div>
            )}
            <button onClick={() => ask(i, it)} disabled={a?.loading}
              style={{ marginTop: "auto", padding: "9px 16px", borderRadius: 11, border: "none", cursor: a?.loading ? "default" : "pointer", fontWeight: 700, fontSize: 13, color: "#05060f", background: "linear-gradient(120deg,var(--cyan),var(--violet))", alignSelf: "flex-start" }}>
              {a?.loading ? "思考中…" : askLabel}
            </button>
            {a?.text && (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: "rgba(34,211,238,.06)", border: "1px solid rgba(34,211,238,.2)", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {a.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
