"use client";
import { useState } from "react";

type Row = { student_no: string; name: string; class?: string; college?: string; major?: string };
type Res = { student_no: string; name: string; status: "created" | "exists" | "failed"; error?: string };

// 弹性表头匹配：把各种叫法归到标准字段
const ALIASES: Record<keyof Row, string[]> = {
  student_no: ["学号", "studentno", "student_no", "no", "编号", "工号", "学号/工号"],
  name: ["姓名", "name", "名字", "学生姓名"],
  class: ["班级", "class", "行政班", "班级名称"],
  college: ["学院", "college", "院系", "二级学院"],
  major: ["专业", "major", "专业名称"],
};
function fieldOf(header: string): keyof Row | null {
  const h = header.toString().trim().toLowerCase().replace(/\s/g, "");
  for (const f of Object.keys(ALIASES) as (keyof Row)[]) if (ALIASES[f].some((a) => a.toLowerCase() === h)) return f;
  return null;
}

export default function RosterImport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [password, setPassword] = useState("Bjwlxy@2026");
  const [credits, setCredits] = useState(120);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; exists: number; failed: number; results: Res[] } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(""); setResult(null); setRows([]); setFileName(f.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
      if (!grid.length) { setErr("表格是空的"); return; }
      const headers = (grid[0] as unknown[]).map((x) => (x ?? "").toString());
      const colMap = headers.map(fieldOf);
      if (!colMap.includes("student_no")) { setErr("没找到「学号」列，请确认表头含 学号/student_no"); return; }
      const out: Row[] = [];
      for (let i = 1; i < grid.length; i++) {
        const r = grid[i] as unknown[];
        const row: Row = { student_no: "", name: "" };
        colMap.forEach((f, c) => { if (f) (row[f] as string) = (r[c] ?? "").toString().trim(); });
        if (row.student_no) out.push(row);
      }
      if (!out.length) { setErr("没有解析到有效行（每行需有学号）"); return; }
      setRows(out);
    } catch (e2) {
      setErr("解析失败：" + (e2 instanceof Error ? e2.message : "请用 CSV 或 XLSX"));
    }
  }

  async function doImport() {
    if (!rows.length || busy) return;
    if (password.trim().length < 6) { setErr("初始密码至少 6 位"); return; }
    setBusy(true); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/admin/import-roster", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, password: password.trim(), credits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || ("导入失败 " + res.status)); }
      else setResult(data);
    } catch { setErr("网络错误，请确认能访问 Supabase（国内需代理）"); }
    setBusy(false);
  }

  const inp: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13.5, outline: "none", fontFamily: "inherit" };

  return (
    <div>
      <div style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 13.5, color: "var(--mut)", lineHeight: 1.7, marginBottom: 14 }}>
          上传班级名册（CSV 或 XLSX），表头需包含 <b style={{ color: "var(--ink)" }}>学号、姓名</b>（可选 班级/学院/专业）。导入会为每位学生创建登录账号，账号=学号、密码=下方统一初始密码。已存在的账号会重置为该密码（可重复导入）。
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...inp, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            📎 选择文件
            <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} style={{ display: "none" }} />
          </label>
          {fileName && <span style={{ fontSize: 12.5, color: "var(--mut)" }}>{fileName} · 解析到 {rows.length} 行</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--mut)" }}>初始密码 <input value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inp, width: 150 }} /></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--mut)" }}>初始积分 <input type="number" value={credits} onChange={(e) => setCredits(Math.max(0, parseInt(e.target.value) || 0))} style={{ ...inp, width: 90 }} /></span>
          <button onClick={doImport} disabled={!rows.length || busy}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 13.5, color: "#05060f", cursor: (!rows.length || busy) ? "default" : "pointer", background: "linear-gradient(120deg,var(--cyan),var(--violet))", opacity: (!rows.length || busy) ? 0.5 : 1, fontFamily: "inherit" }}>
            {busy ? "导入中…" : `确认导入 ${rows.length} 人`}
          </button>
        </div>
        {err && <div style={{ color: "#ff7a8a", fontSize: 13, marginTop: 12 }}>{err}</div>}
      </div>

      {rows.length > 0 && !result && (
        <Preview rows={rows} />
      )}

      {result && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
            导入完成：<span style={{ color: "var(--cyan)" }}>新建 {result.created}</span> · <span style={{ color: "var(--mut)" }}>已存在 {result.exists}</span>{result.failed > 0 && <> · <span style={{ color: "#ff7a8a" }}>失败 {result.failed}</span></>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 12 }}>所有账号初始密码：<b style={{ color: "var(--ink)" }}>{password}</b>，请通知学生首次登录后到「账户中心」修改。</div>
          {result.failed > 0 && (
            <div style={{ fontSize: 12.5, color: "#ff9aa6" }}>
              失败明细：{result.results.filter((r) => r.status === "failed").map((r) => `${r.student_no || "(无学号)"}(${r.error})`).join("；")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Preview({ rows }: { rows: Row[] }) {
  const show = rows.slice(0, 8);
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--mut)", fontWeight: 600, borderBottom: "1px solid var(--line)" };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,.05)" };
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 18, overflowX: "auto" }}>
      <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 10 }}>预览（前 {show.length} / 共 {rows.length} 行）：</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>学号</th><th style={th}>姓名</th><th style={th}>班级</th><th style={th}>学院</th><th style={th}>专业</th></tr></thead>
        <tbody>
          {show.map((r, i) => (
            <tr key={i}><td style={td}>{r.student_no}</td><td style={td}>{r.name}</td><td style={td}>{r.class || "—"}</td><td style={td}>{r.college || "—"}</td><td style={td}>{r.major || "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
