"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ACTION_LABEL: Record<string, string> = { chat: "对话", topic: "选题", text: "文本生成", ppt: "PPT", image: "配图", defense: "答辩", data: "数据分析", tts: "语音" };
type Log = { user_id: string; action: string; cost: number; created_at: string };

export default function UsageStats() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("usage_logs").select("user_id,action,cost,created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.from("profiles").select("id,name,student_no").limit(2000),
      ]);
      setLogs((l as Log[]) || []);
      const m: Record<string, string> = {};
      for (const r of (p as { id: string; name: string | null; student_no: string | null }[]) || []) m[r.id] = r.name || r.student_no || r.id.slice(0, 6);
      setNames(m); setLoading(false);
    })();
  }, []);

  const agg = useMemo(() => {
    const byAction = new Map<string, { calls: number; cost: number }>();
    const byUser = new Map<string, { calls: number; cost: number }>();
    let calls = 0, cost = 0;
    for (const r of logs) {
      calls++; cost += r.cost || 0;
      const a = byAction.get(r.action) || { calls: 0, cost: 0 }; a.calls++; a.cost += r.cost || 0; byAction.set(r.action, a);
      const u = byUser.get(r.user_id) || { calls: 0, cost: 0 }; u.calls++; u.cost += r.cost || 0; byUser.set(r.user_id, u);
    }
    return {
      calls, cost,
      actions: [...byAction.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.calls - a.calls),
      top: [...byUser.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.cost - a.cost).slice(0, 12),
    };
  }, [logs]);

  const card: React.CSSProperties = { flex: 1, minWidth: 150, border: "1px solid var(--line)", borderRadius: 14, background: "rgba(255,255,255,.04)", padding: "14px 16px" };
  const box: React.CSSProperties = { flex: 1, minWidth: 300, border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 16 };
  const th: React.CSSProperties = { textAlign: "left", padding: "7px 8px", fontSize: 12, color: "var(--mut)", fontWeight: 600, borderBottom: "1px solid var(--line)" };
  const td: React.CSSProperties = { padding: "7px 8px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,.05)" };

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: "var(--mut)" }}>加载中…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={card}><div style={{ fontSize: 12, color: "var(--mut)" }}>总调用次数</div><div style={{ fontSize: 26, fontWeight: 800, color: "var(--cyan)" }}>{agg.calls}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--mut)" }}>总消耗积分</div><div style={{ fontSize: 26, fontWeight: 800, color: "#ff8a5c" }}>{agg.cost}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--mut)" }}>活跃用户</div><div style={{ fontSize: 26, fontWeight: 800 }}>{new Set(logs.map((l) => l.user_id)).size}</div></div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 14 }}>（基于最近 {logs.length} 条调用记录）</div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>按用途分布</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>用途</th><th style={th}>次数</th><th style={th}>积分</th></tr></thead>
            <tbody>
              {agg.actions.map((a) => (<tr key={a.k}><td style={td}>{ACTION_LABEL[a.k] || a.k}</td><td style={td}>{a.calls}</td><td style={td}>{a.cost}</td></tr>))}
              {agg.actions.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: "var(--mut)" }}>暂无记录</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>消耗 Top 用户</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>用户</th><th style={th}>次数</th><th style={th}>积分</th></tr></thead>
            <tbody>
              {agg.top.map((u) => (<tr key={u.k}><td style={td}>{names[u.k] || u.k.slice(0, 6)}</td><td style={td}>{u.calls}</td><td style={td}>{u.cost}</td></tr>))}
              {agg.top.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: "var(--mut)" }}>暂无记录</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
