"use client";
// 教师端 · 干预督导台（P2）：全班督导卡队列。
// 申诉卡（学生点了"不同意"）置顶等教师裁决：可撤回卡片（承认学生有理）或写裁决备注（维持意见）。
// 每张卡可一键跳到该生成长星图（教师视角）核对证据。
import { useEffect, useState } from "react";
import Link from "next/link";

type Card = {
  id: number; user_id: string; rule: string; sharp: string; evidence: string; advice: string;
  status: string; student_note: string; teacher_note: string; created_at: string;
  student: { id: string; name: string | null; student_no: string | null } | null;
};

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "待学生回应", color: "#9aa6c8" },
  accepted: { label: "已接受", color: "#34d399" },
  improved: { label: "已改进", color: "#22d3ee" },
  disputed: { label: "申诉中", color: "#f5a623" },
  retracted: { label: "已撤回", color: "#f87171" },
};

export default function InterventionAdmin() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [err, setErr] = useState("");
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/interventions?all=1")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "加载失败 " + r.status);
        setCards(d.cards || []);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "网络错误"));
  useEffect(() => { load(); }, []);

  const act = async (id: number, action: "retract" | "note", n: string) => {
    if (busy) return;
    setBusy(true);
    await fetch("/api/interventions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, note: n }),
    }).catch(() => {});
    setNoteFor(null); setNote(""); setBusy(false);
    load();
  };

  if (err) return <p style={{ color: "#f87171", fontSize: 14 }}>{err}</p>;
  if (cards === null) return <p style={{ color: "var(--mut)", fontSize: 14 }}>加载中…</p>;
  if (!cards.length) return <p style={{ color: "var(--mut)", fontSize: 14 }}>还没有督导卡。学生打开「成长星图」时系统会自动体检其证据链，命中风险模式即发卡。</p>;

  const disputed = cards.filter((c) => c.status === "disputed");
  const rest = cards.filter((c) => c.status !== "disputed");
  const btn = (color: string): React.CSSProperties => ({
    fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${color}66`, background: `${color}18`, color, fontFamily: "inherit",
  });

  const renderCard = (c: Card, hot: boolean) => {
    const s = STATUS[c.status] || { label: c.status, color: "#9aa6c8" };
    const who = c.student ? `${c.student.name || "（未命名）"}${c.student.student_no ? " · " + c.student.student_no : ""}` : c.user_id.slice(0, 8);
    return (
      <div key={c.id} style={{ border: `1px solid ${hot ? "rgba(245,166,35,.5)" : "var(--line)"}`, borderRadius: 14, background: hot ? "rgba(245,166,35,.06)" : "rgba(255,255,255,.03)", padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <b style={{ fontSize: 13.5 }}>🦉 {who}</b>
          <span style={{ fontSize: 11, color: s.color, border: `1px solid ${s.color}66`, borderRadius: 999, padding: "2px 9px", fontWeight: 700 }}>{s.label}</span>
          <span style={{ fontSize: 11, color: "var(--mut)" }}>{new Date(c.created_at).toLocaleString("zh-CN")}</span>
          <Link href={`/me/growth?user=${c.user_id}`} style={{ marginLeft: "auto", fontSize: 12, color: "var(--cyan)", textDecoration: "none" }}>查看其成长星图 →</Link>
        </div>
        <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>“{c.sharp}”</p>
        <p style={{ fontSize: 12, color: "var(--mut)", lineHeight: 1.7 }}>📌 {c.evidence}</p>
        {c.student_note && <p style={{ fontSize: 12.5, color: "#f5a623", lineHeight: 1.7, marginTop: 4 }}>✋ 学生申诉：{c.student_note}</p>}
        {c.teacher_note && <p style={{ fontSize: 12.5, color: "#22d3ee", lineHeight: 1.7, marginTop: 4 }}>👩‍🏫 教师裁决：{c.teacher_note}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <button style={btn("#f87171")} disabled={busy} onClick={() => act(c.id, "retract", note || "教师复核后撤回本卡")}>撤回卡片</button>
          <button style={btn("#22d3ee")} disabled={busy} onClick={() => setNoteFor(noteFor === c.id ? null : c.id)}>写裁决备注</button>
          {noteFor === c.id && (
            <span style={{ display: "flex", gap: 6, flex: 1, minWidth: 240 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="裁决意见（学生可见）…"
                style={{ flex: 1, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, outline: "none" }} />
              <button style={btn("#22d3ee")} disabled={busy || !note.trim()} onClick={() => act(c.id, "note", note.trim())}>提交</button>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 14, lineHeight: 1.7 }}>
        系统按学生证据链实时发卡（AI 辅助评判，仅供参考）。学生点「不同意」的申诉卡置顶，请老师裁决：撤回=学生有理；备注=维持意见并说明。
      </p>
      {disputed.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#f5a623", marginBottom: 8 }}>✋ 待裁决申诉（{disputed.length}）</h3>
          {disputed.map((c) => renderCard(c, true))}
        </>
      )}
      <h3 style={{ fontSize: 14, fontWeight: 800, margin: "12px 0 8px" }}>全部督导卡（{cards.length}）</h3>
      {rest.map((c) => renderCard(c, false))}
    </div>
  );
}
