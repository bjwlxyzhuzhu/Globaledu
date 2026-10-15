"use client";
import { useEffect, useRef, useState } from "react";
import AttachBar from "../AttachBar";
import type { Att } from "@/lib/attach";
import { downloadMarkdown, downloadWord, printPdf } from "@/lib/download";
import { logClientEvidence } from "@/lib/evidenceClient";

type Msg = { role: "user" | "assistant"; content: string };

/** 成长星图存证描述：传了它，达到里程碑门槛的 AI 产出会被服务端盖章写入证据链 */
export type EvidenceDesc = {
  kind: "topic_match" | "bp_draft" | "expert_review" | "defense_radar" | "crew_final";
  title?: string;
  meta?: Record<string, unknown>;
  rubric?: { dim: string; w: number }[];
};

/** 创新中心通用多轮对话面板（小创人设，接 RAG /api/ai/ask 含国赛手册）。选题/答辩/专家打磨共用。 */
export default function CoachSession({
  system, greeting, placeholder = "输入你的回答…", accent = "#ff6b35",
  quickActions = [], onReply, multiline = false, exportTitle = "对话记录", promptTags = [], evidence,
}: {
  system: string;
  greeting: string;
  placeholder?: string;
  accent?: string;
  quickActions?: { label: string; message: string }[];
  onReply?: (text: string, msgs: Msg[]) => void;
  multiline?: boolean;
  exportTitle?: string;
  promptTags?: string[];
  evidence?: EvidenceDesc;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [atts, setAtts] = useState<Att[]>([]);
  const [polishing, setPolishing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [msgs, sending]);

  async function send(text: string) {
    const q = (text || "").trim() || (atts.length ? "请结合附件帮我分析。" : "");
    if (!q || sending) return;
    const shown = q + (atts.length ? `　📎 ${atts.map((a) => a.name).join("、")}` : "");
    const next: Msg[] = [...msgs, { role: "user", content: shown }];
    setMsgs(next);
    setInput("");
    const sentAtts = atts;
    setAtts([]);
    setSending(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-10), system, attachments: sentAtts,
          ...(evidence ? { evidence: { ...evidence, title: evidence.title || exportTitle } } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      let reply: string;
      if (res.status === 401) reply = "请先登录后再用我哦（右上角 → 登录）。";
      else if (res.status === 402) reply = "积分不足啦～可在账户中心绑定自己的 API Key（不扣积分）。";
      else if (!res.ok) reply = "出错了：" + (data.error || res.status);
      else {
        const t = data.text || "(空回复)";
        const srcs: { title?: string; source?: string }[] = Array.isArray(data.sources) ? data.sources : [];
        const names = [...new Set(srcs.map((s) => s.title || s.source).filter(Boolean))].slice(0, 3);
        reply = names.length ? `${t}\n\n📚 参考：${names.join("、")}` : t;
      }
      const after: Msg[] = [...next, { role: "assistant", content: reply }];
      setMsgs(after);
      if (res.ok) onReply?.(data.text || "", after);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "网络错误，请确认能访问 APIMart。" }]);
    }
    setSending(false);
  }

  async function polish() {
    const t = input.trim();
    if (!t || polishing || sending) return;
    setPolishing(true);
    try {
      const res = await fetch("/api/ai/polish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) setInput(data.text);
      else if (res.status === 401) setMsgs((m) => [...m, { role: "assistant", content: "请先登录后再用润色哦（右上角 → 登录）。" }]);
    } catch { /* 网络错误：保留原输入 */ }
    setPolishing(false);
  }

  const hasChat = msgs.some((m) => m.role === "user");
  const fileBase = (exportTitle || "对话记录").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  const toMarkdown = () =>
    `# ${exportTitle}\n\n> 导出时间：${new Date().toLocaleString("zh-CN")}\n` +
    msgs.map((m) => `\n**${m.role === "user" ? "🙋 我" : "🤖 助手"}：**\n\n${m.content}\n`).join("");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "min(64vh, 560px)", border: "1px solid var(--line)", borderRadius: 18, background: "rgba(10,14,34,.6)", backdropFilter: "blur(14px)", overflow: "hidden" }}>
      {hasChat && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--mut)" }}>导出问答：</span>
          {([["Markdown", () => { downloadMarkdown(fileBase + ".md", toMarkdown()); logClientEvidence("export_doc", { title: exportTitle, payload: { fmt: "md" } }); }],
             ["Word", () => { downloadWord(fileBase + ".doc", exportTitle, toMarkdown()); logClientEvidence("export_doc", { title: exportTitle, payload: { fmt: "word" } }); }],
             ["PDF", () => { printPdf(exportTitle, toMarkdown()); logClientEvidence("export_doc", { title: exportTitle, payload: { fmt: "pdf" } }); }]] as const).map(([lbl, fn]) => (
            <button key={lbl} onClick={fn}
              style={{ fontSize: 11.5, padding: "5px 11px", borderRadius: 999, border: `1px solid ${accent}66`, background: `${accent}14`, color: accent, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              ⬇ {lbl}
            </button>
          ))}
        </div>
      )}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%",
            padding: "10px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap",
            color: m.role === "user" ? "#05060f" : "var(--ink)",
            background: m.role === "user" ? `linear-gradient(120deg,${accent},#ffb657)` : "rgba(255,255,255,.05)",
            border: m.role === "user" ? "none" : "1px solid var(--line)",
          }}>{m.content}</div>
        ))}
        {sending && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "var(--mut)" }}>小创思考中…</div>}
      </div>

      {quickActions.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "0 12px 8px", flexWrap: "wrap" }}>
          {quickActions.map((a) => (
            <button key={a.label} onClick={() => send(a.message)} disabled={sending}
              style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid ${accent}88`, background: `${accent}1f`, color: accent, fontWeight: 700, fontSize: 12.5, cursor: sending ? "default" : "pointer", fontFamily: "inherit" }}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {promptTags.length > 0 && !input.trim() && (
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--mut)" }}>💡 试试问：</span>
          {promptTags.map((p) => (
            <button key={p} onClick={() => setInput(p)}
              style={{ fontSize: 11.5, padding: "5px 11px", borderRadius: 999, border: "1px dashed var(--line)", background: "transparent", color: "var(--mut)", cursor: "pointer", fontFamily: "inherit" }}>
              {p}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "0 12px 8px" }}>
        <AttachBar atts={atts} setAtts={setAtts} accent={accent} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)", alignItems: "flex-end" }}>
        {multiline ? (
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={placeholder} rows={2}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,.04)", color: "var(--ink)", fontSize: 14, outline: "none", resize: "vertical", minHeight: 46, fontFamily: "inherit", lineHeight: 1.6 }} />
        ) : (
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder={placeholder}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,.04)", color: "var(--ink)", fontSize: 14, outline: "none" }} />
        )}
        <button onClick={polish} disabled={polishing || sending || !input.trim()} title="一键润色：把你的提问改得更清晰、具体"
          style={{ padding: "0 13px", height: 44, borderRadius: 12, border: `1px solid ${accent}66`, background: "transparent", color: accent, cursor: (polishing || sending || !input.trim()) ? "default" : "pointer", fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap", fontFamily: "inherit", opacity: !input.trim() ? 0.45 : 1 }}>
          {polishing ? "润色中…" : "✨ 润色"}
        </button>
        <button onClick={() => send(input)} disabled={sending}
          style={{ padding: "0 20px", height: 44, borderRadius: 12, border: "none", cursor: sending ? "default" : "pointer", fontWeight: 800, color: "#05060f", background: `linear-gradient(120deg,${accent},#ffb657)`, fontFamily: "inherit" }}>
          发送
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--mut)", textAlign: "center", padding: "0 12px 8px" }}>
        AI 辅助生成，请自行核验；最终判断与责任由师生承担
      </div>
    </div>
  );
}
