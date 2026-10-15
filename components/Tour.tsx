"use client";
// 通用新手引导：半透明遮罩 + 聚光高亮，按编号顺序提示先点什么、再点什么。首次进入自动播一次（localStorage 去重），
// 提供「下次不再提示」勾选；左下角 ❔ 可随时重看。首页与驾驶舱共用本组件，仅 steps / seenKey 不同。
import { useCallback, useEffect, useState } from "react";

export type TourStep = { sel?: string; badge: string; title: string; body: string };

const btnGhost: React.CSSProperties = { padding: "7px 12px", borderRadius: 9, border: "1px solid rgba(160,180,230,.3)", background: "transparent", color: "#cdd8f5", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const btnPrimary: React.CSSProperties = { padding: "7px 16px", borderRadius: 9, border: "none", background: "linear-gradient(120deg,#22d3ee,#7c5cff)", color: "#04030f", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };

export default function Tour({ steps, seenKey, active, helpTitle = "新手引导" }: { steps: TourStep[]; seenKey: string; active: boolean; helpTitle?: string }) {
  const [running, setRunning] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dontShow, setDontShow] = useState(false); // 默认不勾选：看完不勾就下次还会自动弹，勾了才永久不再提示
  const step = steps[i];

  const measure = useCallback(() => {
    const sel = steps[i]?.sel;
    if (!sel) { setRect(null); return; }
    const r = document.querySelector(sel)?.getBoundingClientRect();
    setRect(r && r.width > 4 && r.height > 4 ? r : null);
  }, [i, steps]);

  // 首次进入自动播
  useEffect(() => {
    if (!active) return;
    let seen = false;
    try { seen = !!localStorage.getItem(seenKey); } catch { /* ignore */ }
    if (seen) return;
    const t = setTimeout(() => { setI(0); setRunning(true); }, 700);
    return () => clearTimeout(t);
  }, [active, seenKey]);

  // 测量目标
  useEffect(() => {
    if (!running) return;
    measure();
    const r1 = setTimeout(measure, 120), r2 = setTimeout(measure, 360);
    const onR = () => measure();
    window.addEventListener("resize", onR);
    window.addEventListener("scroll", onR, true);
    return () => { clearTimeout(r1); clearTimeout(r2); window.removeEventListener("resize", onR); window.removeEventListener("scroll", onR, true); };
  }, [running, i, measure]);

  function close() {
    try { if (dontShow) localStorage.setItem(seenKey, "1"); else localStorage.removeItem(seenKey); } catch { /* ignore */ }
    setRunning(false);
  }
  function next() { if (i >= steps.length - 1) close(); else setI((v) => v + 1); }
  function prev() { if (i > 0) setI((v) => v - 1); }

  if (!running) {
    if (!active) return null;
    return (
      <button onClick={() => { setI(0); setRunning(true); }} title={helpTitle}
        style={{ position: "fixed", left: 16, bottom: 16, zIndex: 150, display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(124,200,255,.45)", background: "rgba(10,14,34,.8)", backdropFilter: "blur(8px)", color: "#cfe0ff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 18px #0007", fontFamily: "inherit" }}>❔ {helpTitle}</button>
    );
  }

  const cardW = 320, last = i >= steps.length - 1;
  let cardStyle: React.CSSProperties;
  let spot: React.CSSProperties | null = null;
  if (rect) {
    const pad = 10;
    spot = { position: "fixed", left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, borderRadius: 18, border: "2px solid #8b7bff", zIndex: 1001, pointerEvents: "none", transition: "all .3s ease", animation: "tourPulse 1.6s ease-in-out infinite" };
    const placeBelow = rect.bottom + 230 < window.innerHeight;
    const top = placeBelow ? rect.bottom + 16 : Math.max(16, rect.top - 230);
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 12);
    cardStyle = { position: "fixed", left, top, width: cardW, zIndex: 1002 };
  } else {
    cardStyle = { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: cardW, zIndex: 1002 };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      {!rect && <div style={{ position: "absolute", inset: 0, background: "rgba(3,5,16,.8)" }} />}
      {spot && <div style={spot} />}
      <div style={cardStyle}>
        <div style={{ background: "linear-gradient(135deg, rgba(14,18,42,.98), rgba(26,16,48,.98))", border: "1px solid rgba(140,123,255,.5)", borderRadius: 16, padding: 18, boxShadow: "0 20px 60px #000b", color: "#eaf1ff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800, background: "linear-gradient(120deg,#22d3ee,#7c5cff)", color: "#04030f", flex: "0 0 auto" }}>{step.badge}</span>
            <b style={{ fontSize: 16 }}>{step.title}</b>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#cdd8f5" }}>{step.body}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9fb0d6", marginTop: 14, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} style={{ accentColor: "#7c5cff", width: 14, height: 14 }} /> 下次不再提示
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 5, marginRight: "auto" }}>
              {steps.map((_, k) => <span key={k} style={{ width: 7, height: 7, borderRadius: "50%", background: k === i ? "#8b7bff" : "rgba(160,180,230,.3)", transition: "background .2s" }} />)}
            </div>
            <button onClick={close} style={btnGhost}>跳过</button>
            {i > 0 && <button onClick={prev} style={btnGhost}>上一步</button>}
            <button onClick={next} style={btnPrimary}>{last ? "开始探索 ✓" : "下一步 →"}</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes tourPulse{0%,100%{box-shadow:0 0 0 9999px rgba(3,5,16,.8),0 0 0 2px #8b7bff}50%{box-shadow:0 0 0 9999px rgba(3,5,16,.8),0 0 24px 5px rgba(139,123,255,.6)}}`}</style>
    </div>
  );
}
