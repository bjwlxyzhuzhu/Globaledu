"use client";
import { useState } from "react";
import LearnChrome from "@/app/learn/LearnChrome";
import RosterImport from "./RosterImport";
import StudentManager from "./StudentManager";
import KnowledgeAdmin from "./KnowledgeAdmin";
import UsageStats from "./UsageStats";
import ChaoxingAdmin from "./ChaoxingAdmin";
import InterventionAdmin from "./InterventionAdmin";
import EffectPanel from "./EffectPanel";
import ResearchExport from "./ResearchExport";

const TABS = [
  { key: "roster", label: "📋 名册导入" },
  { key: "students", label: "👥 学生管理" },
  { key: "knowledge", label: "📚 知识库" },
  { key: "usage", label: "📊 用量统计" },
  { key: "effect", label: "📈 成效面板" },
  { key: "interventions", label: "🦉 干预督导" },
  { key: "research", label: "📦 研究数据导出" },
  { key: "chaoxing", label: "🔗 超星对接" },
] as const;
type TabKey = typeof TABS[number]["key"];

export default function AdminConsole({ me }: { me: { id: string; name: string | null; role: string | null } }) {
  const [tab, setTab] = useState<TabKey>("roster");
  return (
    <LearnChrome emoji="🛠" title="管理端" subtitle={`${me.name || ""} · ${me.role === "admin" ? "管理员" : "教师"}`}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "9px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: on ? 800 : 600, cursor: "pointer", fontFamily: "inherit",
                border: "1px solid " + (on ? "rgba(34,211,238,.6)" : "var(--line)"),
                background: on ? "rgba(34,211,238,.16)" : "rgba(255,255,255,.04)", color: on ? "var(--cyan)" : "var(--ink)" }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "roster" && <RosterImport />}
      {tab === "students" && <StudentManager meId={me.id} />}
      {tab === "knowledge" && <KnowledgeAdmin />}
      {tab === "usage" && <UsageStats />}
      {tab === "effect" && <EffectPanel />}
      {tab === "interventions" && <InterventionAdmin />}
      {tab === "chaoxing" && <ChaoxingAdmin />}
      {tab === "research" && <ResearchExport />}
    </LearnChrome>
  );
}
