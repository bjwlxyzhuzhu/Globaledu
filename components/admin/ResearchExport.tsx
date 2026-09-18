"use client";
import { useState } from "react";
import * as XLSX from "xlsx";

const SHEETS = ["students", "challenge_sessions", "dialogue_turns", "plan_versions", "ct_ratings", "peer_feedback", "usage_logs", "evidence_events", "projects"];

export default function ResearchExport() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function exportData() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/research-export");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const wb = XLSX.utils.book_new();
      for (const name of SHEETS) {
        const rows = Array.isArray(data[name]) ? data[name] : [];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
      }
      XLSX.writeFile(wb, `双创智能体平台_匿名研究数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setMsg(`已导出 ${data.students?.length || 0} 名学生的匿名数据`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "导出失败"); }
    finally { setBusy(false); }
  }
  return <div style={{ border: "1px solid var(--line)", borderRadius: 16, padding: 18, background: "rgba(255,255,255,.04)" }}>
    <h3 style={{ margin: "0 0 8px", color: "var(--ink)" }}>研究数据导出</h3>
    <p style={{ margin: "0 0 14px", color: "var(--mut)", fontSize: 13, lineHeight: 1.7 }}>导出已同意科研使用学生的匿名数据，适用于课堂测试、对抗性多智能体对话和论文统计分析。姓名、学号、邮箱不会进入导出文件。</p>
    <button onClick={exportData} disabled={busy} style={{ padding: "10px 16px", border: 0, borderRadius: 10, cursor: busy ? "wait" : "pointer", color: "#04030f", fontWeight: 800, background: "linear-gradient(120deg,#22d3ee,#7c5cff)", opacity: busy ? .65 : 1 }}>{busy ? "正在整理数据…" : "导出匿名研究数据 Excel"}</button>
    {msg && <span style={{ marginLeft: 12, fontSize: 13, color: msg.startsWith("已导出") ? "#7ef0c0" : "#ff8c9a" }}>{msg}</span>}
  </div>;
}