"use client";
// 成长星图（P1）：一个学生 = 一次航行，每个里程碑产出 = 一颗星。
// 主轴是「人的故事」：官方评分维度的能力成长曲线（答辩雷达时序）；每颗星可点开回放当时的真实产物。
// 数据来自 /api/evidence（服务端盖章存证，学生端无法伪造）；教师可加 ?user=<id> 查看指定学生。
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LearnChrome from "../../learn/LearnChrome";
import RadarChart from "../../apply/RadarChart";

type Ev = {
  id: number; project_id: string | null; kind: string; title: string;
  dims: { key?: string; axes: { dim: string; score: number; max: number }[]; total: number } | null;
  payload: { q?: string; a?: string; fmt?: string; meta?: Record<string, unknown>; [k: string]: unknown };
  created_at: string;
};

type ICard = {
  id: number; rule: string; sharp: string; evidence: string; advice: string;
  link_href: string; link_label: string; status: string;
  student_note: string; teacher_note: string; created_at: string; responded_at: string | null;
};

const CARD_STATUS: Record<string, { label: string; color: string }> = {
  accepted: { label: "已接受", color: "#34d399" },
  improved: { label: "已改进", color: "#22d3ee" },
  disputed: { label: "申诉中 · 待教师裁决", color: "#f5a623" },
};

/** 猫头鹰督导卡：四段式（一针见血→证据→怎么改→去哪练）+ 学生三按钮 */
function OwlCards({ cards, readOnly, onRespond }: {
  cards: ICard[]; readOnly: boolean;
  onRespond: (id: number, action: string, note: string) => Promise<void>;
}) {
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const open = cards.filter((c) => c.status === "open");
  const done = cards.filter((c) => c.status !== "open");
  if (!cards.length) return null;

  const act = async (id: number, action: string, n = "") => {
    if (busy) return;
    setBusy(true);
    await onRespond(id, action, n).catch(() => {});
    setNoteFor(null); setNote(""); setBusy(false);
  };
  const btn = (color: string): React.CSSProperties => ({
    fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${color}66`, background: `${color}18`, color, fontFamily: "inherit",
  });

  return (
    <div style={{ marginBottom: 16 }}>
      {open.map((c) => (
        <div key={c.id} style={{ border: "1px solid rgba(245,166,35,.45)", borderRadius: 18, background: "rgba(245,166,35,.07)", padding: 18, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22 }}>🦉</span>
            <b style={{ fontSize: 14.5 }}>夜枭督导 · 干预卡</b>
            <span style={{ fontSize: 11, color: "var(--mut)", marginLeft: "auto" }}>
              {new Date(c.created_at).toLocaleDateString("zh-CN")} · AI 自动辅助评判，仅供你和老师参考，不代表成绩
            </span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.6, marginBottom: 8 }}>“{c.sharp}”</p>
          <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.7, marginBottom: 6 }}><b style={{ color: "var(--ink)" }}>📌 证据：</b>{c.evidence}</p>
          <p style={{ fontSize: 13, lineHeight: 1.75, marginBottom: 10 }}><b>🔧 怎么改：</b>{c.advice}</p>
          {c.link_href && (
            <Link href={c.link_href} style={{ display: "inline-block", fontSize: 13, fontWeight: 800, color: "#f5a623", textDecoration: "none", border: "1px solid rgba(245,166,35,.5)", borderRadius: 999, padding: "8px 16px", marginBottom: readOnly ? 0 : 12 }}>
              🚀 {c.link_label || "去练一练"} →
            </Link>
          )}
          {!readOnly && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
              <button style={btn("#34d399")} disabled={busy} onClick={() => act(c.id, "accepted")}>✅ 接受</button>
              <button style={btn("#22d3ee")} disabled={busy} onClick={() => act(c.id, "improved")}>💪 已改进</button>
              <button style={btn("#f87171")} disabled={busy} onClick={() => setNoteFor(noteFor === c.id ? null : c.id)}>✋ 不同意</button>
              {noteFor === c.id && (
                <span style={{ display: "flex", gap: 6, flex: 1, minWidth: 240 }}>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="说说你的理由，会提交给老师裁决…"
                    style={{ flex: 1, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12.5, outline: "none" }} />
                  <button style={btn("#f87171")} disabled={busy || !note.trim()} onClick={() => act(c.id, "disputed", note.trim())}>提交申诉</button>
                </span>
              )}
            </div>
          )}
        </div>
      ))}
      {done.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--mut)", lineHeight: 2, padding: "0 4px" }}>
          {done.slice(0, 5).map((c) => {
            const s = CARD_STATUS[c.status] || { label: c.status, color: "#9aa6c8" };
            return (
              <div key={c.id}>
                🦉 {new Date(c.created_at).toLocaleDateString("zh-CN")}「{c.sharp.slice(0, 24)}…」
                <b style={{ color: s.color }}> {s.label}</b>
                {c.teacher_note && <span> · 👩‍🏫 教师：{c.teacher_note}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const KIND_META: Record<string, { icon: string; label: string; color: string }> = {
  topic_match: { icon: "🧭", label: "选题结论", color: "#38bdf8" },
  bp_draft: { icon: "📄", label: "BP 成稿", color: "#f5a623" },
  expert_review: { icon: "🦉", label: "专家打磨", color: "#a78bfa" },
  defense_radar: { icon: "🎤", label: "答辩雷达", color: "#ff6b35" },
  crew_final: { icon: "🐼", label: "驾驶舱成稿", color: "#34d399" },
  export_doc: { icon: "⬇️", label: "成果导出", color: "#22d3ee" },
  skill_use: { icon: "🧩", label: "技能启用", color: "#eab308" },
  intervention_response: { icon: "💬", label: "干预回应", color: "#f472b6" },
};
const kindMeta = (k: string) => KIND_META[k] || { icon: "⭐", label: k, color: "#9aa6c8" };

const LINE_COLORS = ["#ff6b35", "#22d3ee", "#a78bfa", "#34d399", "#f5a623", "#f472b6", "#38bdf8"];

const fmtTime = (iso: string) => new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

/** 能力星轨：各官方维度得分率(%)随答辩次数的折线（纯 SVG，无依赖） */
function TrackChart({ defenses }: { defenses: Ev[] }) {
  const dims = useMemo(() => {
    const names: string[] = [];
    for (const d of defenses) for (const a of d.dims?.axes || []) if (!names.includes(a.dim)) names.push(a.dim);
    return names;
  }, [defenses]);
  const series = dims.map((dim, di) => ({
    dim, color: LINE_COLORS[di % LINE_COLORS.length],
    pts: defenses.map((d, i) => {
      const a = (d.dims?.axes || []).find((x) => x.dim === dim);
      return a && a.max ? { i, pct: Math.round((a.score / a.max) * 100) } : null;
    }).filter(Boolean) as { i: number; pct: number }[],
  })).filter((s) => s.pts.length > 0);

  const W = 680, H = 240, PL = 40, PR = 16, PT = 14, PB = 30;
  const n = defenses.length;
  const X = (i: number) => PL + (n <= 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1));
  const Y = (pct: number) => PT + (1 - pct / 100) * (H - PT - PB);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        {[0, 50, 100].map((p) => (
          <g key={p}>
            <line x1={PL} y1={Y(p)} x2={W - PR} y2={Y(p)} stroke="rgba(255,255,255,.1)" strokeDasharray={p === 0 ? "" : "3 4"} />
            <text x={PL - 6} y={Y(p)} fontSize="10" fill="#9aa6c8" textAnchor="end" dominantBaseline="middle">{p}%</text>
          </g>
        ))}
        {defenses.map((d, i) => (
          <text key={d.id} x={X(i)} y={H - 10} fontSize="10" fill="#9aa6c8" textAnchor="middle">
            第{i + 1}次 · {fmtDate(d.created_at)}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.dim}>
            {s.pts.length > 1 && (
              <polyline points={s.pts.map((p) => `${X(p.i)},${Y(p.pct)}`).join(" ")}
                fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
            )}
            {s.pts.map((p) => <circle key={p.i} cx={X(p.i)} cy={Y(p.pct)} r="3.5" fill={s.color} />)}
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, justifyContent: "center" }}>
        {series.map((s) => {
          const first = s.pts[0]?.pct ?? 0, last = s.pts[s.pts.length - 1]?.pct ?? 0, d = last - first;
          return (
            <span key={s.dim} style={{ fontSize: 12, color: "var(--mut)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: s.color, display: "inline-block" }} />
              {s.dim} <b style={{ color: s.color }}>{last}%</b>
              {s.pts.length > 1 && (
                <span style={{ color: d >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{d >= 0 ? `▲${d}` : `▼${-d}`}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function GrowthPage() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [cards, setCards] = useState<ICard[]>([]);
  const [err, setErr] = useState("");
  const [selId, setSelId] = useState<number | null>(null);
  const [viewUser, setViewUser] = useState("");

  const loadCards = (u: string) =>
    fetch("/api/interventions" + (u ? `?user=${encodeURIComponent(u)}` : ""))
      .then((r) => r.json())
      .then((d) => setCards(Array.isArray(d.cards) ? d.cards : []))
      .catch(() => {});

  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("user") || "";
    setViewUser(u);
    fetch("/api/evidence?limit=500" + (u ? `&user=${encodeURIComponent(u)}` : ""))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) throw new Error("请先登录，再来看你的成长星图（右上角 → 登录）");
        if (!r.ok) throw new Error(d.error || "加载失败 " + r.status);
        setEvents(d.events || []);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "网络错误"));
    loadCards(u); // 学生视角会先触发一次实时体检（可能生成新卡）
  }, []);

  const respond = async (id: number, action: string, note: string) => {
    await fetch("/api/interventions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, note }),
    });
    await loadCards(viewUser);
  };

  const defenses = useMemo(() => (events || []).filter((e) => e.kind === "defense_radar" && e.dims?.axes?.length), [events]);
  const sel = useMemo(() => (events || []).find((e) => e.id === selId) || null, [events, selId]);

  const stats = useMemo(() => {
    const ev = events || [];
    const cnt = (k: string) => ev.filter((e) => e.kind === k).length;
    const firstT = defenses[0]?.dims?.total, lastT = defenses[defenses.length - 1]?.dims?.total;
    return [
      { label: "点亮星星", v: ev.length, unit: "颗", color: "#22d3ee" },
      { label: "模拟答辩", v: defenses.length, unit: "场", color: "#ff6b35", extra: defenses.length > 1 && firstT != null && lastT != null ? `总分 ${firstT} → ${lastT}` : "" },
      { label: "成稿/导出", v: cnt("bp_draft") + cnt("crew_final") + cnt("export_doc"), unit: "份", color: "#f5a623" },
      { label: "启用技能", v: cnt("skill_use"), unit: "个", color: "#a78bfa" },
    ];
  }, [events, defenses]);

  const card: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 18, background: "rgba(255,255,255,.045)", backdropFilter: "blur(12px)", padding: 18 };

  return (
    <LearnChrome emoji="🌌" title="成长星图" subtitle="人的故事 · 项目作证 —— 每一颗星都是服务端盖章的真实产出">
      {viewUser && (
        <div style={{ ...card, marginBottom: 14, padding: "10px 16px", fontSize: 13, color: "#f5a623" }}>
          👩‍🏫 教师视角：正在查看指定学生的成长星图
        </div>
      )}
      {err && <div style={{ ...card, color: "#f87171", fontSize: 14 }}>{err} <Link href="/login" style={{ color: "var(--cyan)" }}>去登录 →</Link></div>}
      {!err && events === null && <div style={{ ...card, color: "var(--mut)", fontSize: 14 }}>正在点亮你的星空…</div>}
      {!err && <OwlCards cards={cards} readOnly={!!viewUser} onRespond={respond} />}

      {events !== null && events.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🌑</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>你的星空还是空的</div>
          <p style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.8, marginBottom: 16 }}>
            去完成第一个里程碑，点亮第一颗星：选题结论、BP 成稿、专家打磨、答辩雷达……每一步真实产出都会自动存证在这里。
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {[["🧭 先去选题匹配", "/apply/topic"], ["🎤 来一场模拟答辩", "/apply/defense"], ["🐼 驾驶舱协同成稿", "/apply/cockpit"]].map(([t, href]) => (
              <Link key={href} href={href} style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)", border: "1px solid var(--line)", borderRadius: 999, padding: "9px 16px", textDecoration: "none", background: "rgba(255,255,255,.05)" }}>{t}</Link>
            ))}
          </div>
        </div>
      )}

      {events !== null && events.length > 0 && (
        <>
          {/* 统计带 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ ...card, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--mut)" }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.v}<span style={{ fontSize: 12, color: "var(--mut)", fontWeight: 400 }}> {s.unit}</span></div>
                {"extra" in s && s.extra && <div style={{ fontSize: 11.5, color: "#34d399", fontWeight: 700 }}>{s.extra}</div>}
              </div>
            ))}
          </div>

          {/* 能力星轨：人的故事 */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>🛰️ 能力星轨</h2>
              <span style={{ fontSize: 12, color: "var(--mut)" }}>官方评分维度得分率，随每次模拟答辩演进</span>
            </div>
            {defenses.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--mut)", padding: "14px 0" }}>
                还没有答辩雷达数据。<Link href="/apply/defense" style={{ color: "var(--cyan)" }}>去打一场模拟答辩</Link>，你的第一条能力星轨就会出现在这里。
              </p>
            ) : <TrackChart defenses={defenses} />}
          </div>

          {/* 星链时间线 */}
          <div style={{ ...card }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>✨ 星链 · 里程碑时间线</h2>
              <span style={{ fontSize: 12, color: "var(--mut)" }}>点一颗星，回放当时的真实产物</span>
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "18px 6px 10px", alignItems: "flex-end" }}>
              {events.map((e, i) => {
                const m = kindMeta(e.kind);
                const active = e.id === selId;
                return (
                  <button key={e.id} onClick={() => setSelId(active ? null : e.id)} title={`${m.label} · ${fmtTime(e.created_at)}`}
                    style={{
                      flex: "0 0 auto", width: 54, background: "transparent", border: "none", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit",
                      transform: `translateY(${i % 2 ? 0 : -10}px)`,
                    }}>
                    <span style={{
                      fontSize: active ? 26 : 20, lineHeight: 1, filter: active ? `drop-shadow(0 0 8px ${m.color})` : "none",
                      transition: "font-size .15s",
                    }}>{m.icon}</span>
                    <span style={{ fontSize: 9.5, color: active ? m.color : "var(--mut)", fontWeight: active ? 800 : 400, whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</span>
                  </button>
                );
              })}
            </div>

            {sel && (() => {
              const m = kindMeta(sel.kind);
              return (
                <div style={{ marginTop: 10, border: `1px solid ${m.color}55`, borderRadius: 14, background: `${m.color}0d`, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>{m.icon}</span>
                    <b style={{ fontSize: 14.5 }}>{sel.title || m.label}</b>
                    <span style={{ fontSize: 11.5, color: m.color, border: `1px solid ${m.color}66`, borderRadius: 999, padding: "2px 9px" }}>{m.label}</span>
                    <span style={{ fontSize: 12, color: "var(--mut)", marginLeft: "auto" }}>🕐 {fmtTime(sel.created_at)} · 服务端存证</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: sel.dims?.axes?.length ? "1fr 280px" : "1fr", gap: 14, alignItems: "start" }}>
                    <div>
                      {typeof sel.payload?.q === "string" && sel.payload.q && (
                        <p style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 8, whiteSpace: "pre-wrap" }}><b style={{ color: "var(--ink)" }}>🙋 当时的输入：</b>{sel.payload.q}</p>
                      )}
                      {typeof sel.payload?.a === "string" && sel.payload.a && (
                        <p style={{ fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}><b>🤖 产出回放：</b>{sel.payload.a}</p>
                      )}
                      {typeof sel.payload?.fmt === "string" && (
                        <p style={{ fontSize: 13, color: "var(--mut)" }}>导出格式：{String(sel.payload.fmt).toUpperCase()}</p>
                      )}
                      {!sel.payload?.q && !sel.payload?.a && !sel.payload?.fmt && (
                        <p style={{ fontSize: 13, color: "var(--mut)" }}>本次里程碑已存证（无文本回放内容）。</p>
                      )}
                    </div>
                    {sel.dims?.axes?.length ? (
                      <div>
                        <div style={{ textAlign: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: "var(--mut)" }}>{sel.dims.key || "能力快照"} · 总分 </span>
                          <b style={{ color: m.color, fontSize: 18 }}>{sel.dims.total}</b>
                        </div>
                        <RadarChart axes={sel.dims.axes.map((a) => ({ label: a.dim, score: a.score, max: a.max }))} size={260} accent={m.color} />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })()}
          </div>

          <p style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 14, lineHeight: 1.8 }}>
            🔒 每颗星由服务端在产出发生时自动盖章（身份来自登录会话、时间戳来自数据库），学生端无法伪造或倒填——这是一条可审计的真实成长证据链。评价数据由 AI 辅助生成，仅供学习参考，不代表课程成绩。
          </p>
        </>
      )}
    </LearnChrome>
  );
}
