"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type P = { id: string; student_no: string | null; name: string | null; class: string | null; role: string; credits: number; created_at: string };
const ROLE_LABEL: Record<string, string> = { student: "学生", teacher: "教师", admin: "管理员" };

export default function StudentManager({ meId }: { meId: string }) {
  const [list, setList] = useState<P[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("id,student_no,name,class,role,credits,created_at").order("created_at", { ascending: true }).limit(2000);
    setList((data as P[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return list;
    return list.filter((p) => ((p.student_no || "") + (p.name || "") + (p.class || "")).toLowerCase().includes(k));
  }, [list, q]);

  async function act(op: string, user_id: string, value: unknown): Promise<boolean> {
    setMsg("");
    try {
      const res = await fetch("/api/admin/student", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, user_id, value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg("✗ " + (data.error || res.status)); return false; }
      return true;
    } catch { setMsg("✗ 网络错误"); return false; }
  }
  async function setCredits(p: P) {
    const s = window.prompt(`设置「${p.name || p.student_no}」的积分`, String(p.credits));
    if (s == null) return;
    const v = parseInt(s, 10);
    if (!Number.isFinite(v) || v < 0) { setMsg("✗ 积分值无效"); return; }
    if (await act("credits", p.id, v)) { setList((l) => l.map((x) => x.id === p.id ? { ...x, credits: v } : x)); setMsg(`✓ 已把 ${p.student_no} 的积分设为 ${v}`); }
  }
  async function resetPwd(p: P) {
    const s = window.prompt(`重置「${p.name || p.student_no}」的密码（≥6位）`, "Bjwlxy@2026");
    if (s == null) return;
    if (s.length < 6) { setMsg("✗ 密码至少 6 位"); return; }
    if (await act("password", p.id, s)) setMsg(`✓ 已把 ${p.student_no} 的密码重置为 ${s}`);
  }
  async function setRole(p: P, role: string) {
    if (await act("role", p.id, role)) { setList((l) => l.map((x) => x.id === p.id ? { ...x, role } : x)); setMsg(`✓ ${p.student_no} 角色 → ${ROLE_LABEL[role]}`); }
  }

  const th: React.CSSProperties = { textAlign: "left", padding: "9px 10px", fontSize: 12, color: "var(--mut)", fontWeight: 600, borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 10px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,.05)", whiteSpace: "nowrap" };
  const btn: React.CSSProperties = { padding: "4px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 搜学号 / 姓名 / 班级"
          style={{ width: "min(320px,100%)", padding: "9px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13.5, outline: "none" }} />
        <span style={{ fontSize: 12.5, color: "var(--mut)" }}>{filtered.length} / {list.length} 人</span>
        <button onClick={load} style={btn}>↻ 刷新</button>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✓") ? "var(--cyan)" : "#ff7a8a" }}>{msg}</span>}
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 6, overflowX: "auto" }}>
        {loading ? <div style={{ padding: 30, textAlign: "center", color: "var(--mut)" }}>加载中…</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>学号</th><th style={th}>姓名</th><th style={th}>班级</th><th style={th}>角色</th><th style={th}>积分</th><th style={th}>操作</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={td}>{p.student_no || "—"}{p.id === meId && <span style={{ color: "var(--cyan)", fontSize: 11 }}> (我)</span>}</td>
                  <td style={td}>{p.name || "—"}</td>
                  <td style={td}>{p.class || "—"}</td>
                  <td style={td}>
                    <select value={p.role} disabled={p.id === meId} onChange={(e) => setRole(p, e.target.value)}
                      style={{ ...btn, padding: "4px 6px", opacity: p.id === meId ? 0.6 : 1 }}>
                      <option value="student" style={{ background: "#0a0e22" }}>学生</option>
                      <option value="teacher" style={{ background: "#0a0e22" }}>教师</option>
                      <option value="admin" style={{ background: "#0a0e22" }}>管理员</option>
                    </select>
                  </td>
                  <td style={td}><button onClick={() => setCredits(p)} style={{ ...btn, fontWeight: 700, color: "var(--cyan)" }}>{p.credits} ✎</button></td>
                  <td style={td}><button onClick={() => resetPwd(p)} style={btn}>重置密码</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--mut)" }}>没有匹配的学生</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
