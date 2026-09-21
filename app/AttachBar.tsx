"use client";
import { useId, useState } from "react";
import { uploadAttachment, ACCEPT, type Att } from "@/lib/attach";

const ICON: Record<string, string> = { pdf: "📕", docx: "📄", txt: "📃", pptx: "📊", xlsx: "📈", xls: "📈" };

/** 智能体聊天通用附件栏：📎 选择文件 + 已选文件芯片。父组件持有 atts 状态。
 *  用原生 <label htmlFor> 触发文件框（浏览器原生行为，比 input.click() 更可靠、不会被静默拦截）。 */
export default function AttachBar({ atts, setAtts, accent = "var(--cyan)" }: {
  atts: Att[]; setAtts: React.Dispatch<React.SetStateAction<Att[]>>; accent?: string;
}) {
  const inputId = useId(); // 每个实例唯一 id，避免多个附件栏共用导致 label 指错
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setErr(""); setBusy(true);
    for (const f of files) {
      try { const a = await uploadAttachment(f); setAtts((p) => [...p, a]); }
      catch (ex) { setErr(ex instanceof Error ? ex.message : "上传失败"); }
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {/* 视觉隐藏但仍可被 label 触发（不用 display:none，兼容性更好） */}
      <input id={inputId} type="file" multiple accept={ACCEPT} onChange={onPick}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} />
      <label htmlFor={busy ? undefined : inputId} title="上传附件（PDF/Word/PPT/Excel/图片/txt，≤20MB）"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--mut)", fontSize: 12, cursor: busy ? "default" : "pointer", fontFamily: "inherit", userSelect: "none", opacity: busy ? 0.7 : 1 }}>
        📎 {busy ? "解析中…" : "附件"}
      </label>
      {atts.map((a, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, fontSize: 11.5, border: `1px solid ${accent}66`, background: `${accent}14`, color: "var(--ink)", maxWidth: 180 }}>
          <span>{a.kind === "image" ? "🖼️" : (ICON[(a.name.split(".").pop() || "").toLowerCase()] || "📎")}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
          <button onClick={() => setAtts((p) => p.filter((_, k) => k !== i))} style={{ background: "none", border: "none", color: "var(--mut)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, fontFamily: "inherit" }}>×</button>
        </span>
      ))}
      {err && <span style={{ fontSize: 11.5, color: "#ff8a96" }}>{err}</span>}
    </div>
  );
}
