"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Stats = { knowledge: number; sources: { source: string; n: number }[]; cases: number; templates: number };
type CaseRow = { id: number; code: string; title: string; region: string | null; industry: string | null };
type TplRow = { id: number; name: string; category: string | null; ext: string | null; size_kb: number | null; file: string | null };

export default function KnowledgeAdmin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [tpls, setTpls] = useState<TplRow[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [nt, setNt] = useState({ name: "", category: "计划书", ext: "docx", file: "" });

  async function loadStats() {
    const res = await fetch("/api/admin/knowledge?op=stats");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setStats(data); else setMsg("✗ 统计失败：" + (data.error || res.status));
  }
  async function loadTables() {
    const supabase = createClient();
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("cases").select("id,code,title,region,industry").order("code").limit(500),
      supabase.from("templates").select("id,name,category,ext,size_kb,file").order("sort").limit(500),
    ]);
    setCases((c as CaseRow[]) || []); setTpls((t as TplRow[]) || []);
  }
  async function loadAll() { setLoading(true); await Promise.all([loadStats(), loadTables()]); setLoading(false); }
  // 仅挂载时加载一次（loadAll 只触发 fetch+setState，无需进依赖）
  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function delSource(source: string, n: number) {
    if (!window.confirm(`确定删除来源「${source}」的全部 ${n} 个知识块？不可撤销。`)) return;
    const res = await fetch("/api/admin/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "delete-source", source }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(`✓ 已删除「${source}」${data.deleted} 块`); loadStats(); } else setMsg("✗ " + (data.error || res.status));
  }
  async function delCase(c: CaseRow) {
    if (!window.confirm(`删除案例《${c.title}》？`)) return;
    const { error } = await createClient().from("cases").delete().eq("id", c.id);
    if (error) setMsg("✗ " + error.message); else { setCases((l) => l.filter((x) => x.id !== c.id)); setMsg("✓ 已删除案例"); loadStats(); }
  }
  async function delTpl(t: TplRow) {
    if (!window.confirm(`删除模板《${t.name}》？`)) return;
    const { error } = await createClient().from("templates").delete().eq("id", t.id);
    if (error) setMsg("✗ " + error.message); else { setTpls((l) => l.filter((x) => x.id !== t.id)); setMsg("✓ 已删除模板"); loadStats(); }
  }
  async function addTpl() {
    if (!nt.name.trim()) { setMsg("✗ 模板名必填"); return; }
    const { data, error } = await createClient().from("templates").insert({ name: nt.name.trim(), category: nt.category, ext: nt.ext, file: nt.file || null }).select().single();
    if (error) setMsg("✗ " + error.message); else { setTpls((l) => [...l, data as TplRow]); setNt({ name: "", category: "计划书", ext: "docx", file: "" }); setMsg("✓ 已新增模板"); loadStats(); }
  }

  const card: React.CSSProperties = { flex: 1, minWidth: 140, border: "1px solid var(--line)", borderRadius: 14, background: "rgba(255,255,255,.04)", padding: "14px 16px" };
  const box: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 16, marginTop: 16 };
  const del: React.CSSProperties = { padding: "3px 9px", borderRadius: 8, border: "1px solid rgba(225,29,72,.4)", background: "transparent", color: "#ff7a8a", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" };
  const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13, outline: "none", fontFamily: "inherit" };

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: "var(--mut)" }}>加载中…</div>;

  return (
    <div>
      {msg && <div style={{ fontSize: 12.5, marginBottom: 12, color: msg.startsWith("✓") ? "var(--cyan)" : "#ff7a8a" }}>{msg}</div>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={card}><div style={{ fontSize: 12, color: "var(--mut)" }}>知识块（向量）</div><div style={{ fontSize: 26, fontWeight: 800, color: "var(--cyan)" }}>{stats?.knowledge ?? "—"}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--mut)" }}>案例</div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats?.cases ?? "—"}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--mut)" }}>模板</div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats?.templates ?? "—"}</div></div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>知识库来源（按来源管理）</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(stats?.sources || []).map((s) => (
            <div key={s.source} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <span style={{ flex: 1 }}>{s.source}</span>
              <span style={{ color: "var(--mut)", fontSize: 12 }}>{s.n} 块</span>
              <button onClick={() => delSource(s.source, s.n)} style={del}>删除该来源</button>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>※ 新增知识请用入库脚本（含切块+向量化），后台只做查看与按来源清理。</div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ ...box, flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>案例（{cases.length}）</div>
          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {cases.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0" }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <button onClick={() => delCase(c)} style={del}>删</button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>※ 新增案例请用入库脚本（同时建向量）。</div>
        </div>

        <div style={{ ...box, flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>模板（{tpls.length}）</div>
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {tpls.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0" }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name} <span style={{ color: "var(--mut)" }}>· {t.category}</span></span>
                <button onClick={() => delTpl(t)} style={del}>删</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <input placeholder="模板名" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} style={{ ...inp, flex: 1, minWidth: 120 }} />
            <input placeholder="类别" value={nt.category} onChange={(e) => setNt({ ...nt, category: e.target.value })} style={{ ...inp, width: 80 }} />
            <input placeholder="ext" value={nt.ext} onChange={(e) => setNt({ ...nt, ext: e.target.value })} style={{ ...inp, width: 64 }} />
            <input placeholder="文件URL(可选)" value={nt.file} onChange={(e) => setNt({ ...nt, file: e.target.value })} style={{ ...inp, width: 130 }} />
            <button onClick={addTpl} style={{ padding: "7px 14px", borderRadius: 9, border: "none", fontWeight: 700, fontSize: 12.5, color: "#05060f", cursor: "pointer", background: "linear-gradient(120deg,var(--cyan),var(--violet))", fontFamily: "inherit" }}>新增</button>
          </div>
        </div>
      </div>
    </div>
  );
}
