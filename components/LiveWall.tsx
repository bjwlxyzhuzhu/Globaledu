"use client";
// P4 · 首页实时动态墙：平台累计数字 + 最近里程碑滚动榜（姓名脱敏"某同学"）。
// 数据来自 /api/stats（真实表聚合）；仅当后端开 WALL_DEMO=1 且无真实数据时显示带标注的演示条目。
import { useEffect, useRef, useState } from "react";

type Wall = {
  visits: number; students: number; chats: number; docs: number;
  feed: { text: string; time: string }[]; demo: boolean;
};

const nf = (n: number) => (n >= 10000 ? (n / 10000).toFixed(1) + "w" : String(n));

export default function LiveWall() {
  const [wall, setWall] = useState<Wall | null>(null);
  const [fold, setFold] = useState(false);
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 访问计数（每会话一次）+ 拉数据
    try {
      if (!sessionStorage.getItem("visited_v1")) {
        sessionStorage.setItem("visited_v1", "1");
        void fetch("/api/stats", { method: "POST" }).catch(() => {});
      }
    } catch { /* 隐私模式等 */ }
    fetch("/api/stats").then((r) => r.json()).then((d) => { if (d && Array.isArray(d.feed)) setWall(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!wall || wall.feed.length <= 3) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % wall.feed.length), 2600);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [wall]);

  if (!wall || (!wall.feed.length && !wall.visits && !wall.students)) return null;

  const rows = wall.feed.length
    ? [0, 1, 2].map((k) => wall.feed[(idx + k) % wall.feed.length])
    : [];

  const stats: [string, number][] = [
    ["👀 访问", wall.visits], ["🧑‍🚀 学员", wall.students], ["💬 对话", wall.chats], ["📄 文档", wall.docs],
  ];

  return (
    <div style={{
      position: "fixed", left: 16, bottom: 52, zIndex: 40, width: fold ? "auto" : 288,
      borderRadius: 16, border: "1px solid rgba(120,200,255,.25)",
      background: "rgba(8,12,30,.78)", backdropFilter: "blur(14px)",
      boxShadow: "0 10px 36px rgba(0,0,0,.45)", overflow: "hidden",
      transition: "width .2s",
    }}>
      <button onClick={() => setFold(!fold)}
        style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "9px 13px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--ink)", fontSize: 12.5, fontWeight: 800 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: "#34d399", boxShadow: "0 0 8px #34d399", display: "inline-block" }} />
        实验室实时动态
        {wall.demo && <span style={{ fontSize: 9.5, color: "#f5a623", border: "1px solid rgba(245,166,35,.45)", borderRadius: 999, padding: "1px 7px", fontWeight: 700 }}>演示数据</span>}
        <span style={{ marginLeft: "auto", color: "var(--mut)", fontSize: 11 }}>{fold ? "展开 ▸" : "收起 ▾"}</span>
      </button>

      {!fold && (
        <div style={{ padding: "0 13px 12px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: rows.length ? 10 : 0 }}>
            {stats.map(([lb, v]) => (
              <span key={lb} style={{ fontSize: 11, color: "var(--mut)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "3px 9px" }}>
                {lb} <b style={{ color: "var(--cyan)", fontSize: 12 }}>{nf(v)}</b>
              </span>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={r.text + i} style={{
              display: "flex", gap: 8, alignItems: "baseline", padding: "5px 0",
              borderTop: i ? "1px dashed rgba(255,255,255,.08)" : "none",
              opacity: 1 - i * 0.28, transition: "opacity .4s",
            }}>
              <span style={{ fontSize: 12, lineHeight: 1.5, flex: 1 }}>✨ {r.text}</span>
              <span style={{ fontSize: 10, color: "var(--mut)", whiteSpace: "nowrap" }}>{r.time}</span>
            </div>
          ))}
          {!rows.length && <div style={{ fontSize: 11.5, color: "var(--mut)", padding: "2px 0 4px" }}>等待第一位学员点亮星图…</div>}
        </div>
      )}
    </div>
  );
}
