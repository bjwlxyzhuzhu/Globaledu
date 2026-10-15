"use client";
// 指挥中心驾驶舱 v7：实景背景(room) + 融入式「协同作战大屏」(半透叠在舱内主屏区，实时显示产出) +
// 每位搭子=头像+座椅+控制台(纯 CSS，一体随动)，沿底部整齐一排。平时轻微待命动作，偶尔有人起身走到同事旁交流，
// 轮到自己工作就回到工位高亮、向大屏推送数据。避免白底方块与堆叠。
import { useEffect, useRef, useState } from "react";

export type StageStatus = "idle" | "think" | "write" | "done";
export type StageAgent = {
  key: string; name: string; title: string; emoji: string; color: string;
  x: number; y: number; status: StageStatus; isLead: boolean; locked?: boolean;
};
export type Flight = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; label: string; color: string };
export type ScreenItem = { who: string; color: string; text: string };

function RoomBg() {
  const [src, setSrc] = useState("/cockpit/room.png");
  return <img aria-hidden alt="" src={src} onError={() => { if (src !== "/cockpit-bg.png") setSrc("/cockpit-bg.png"); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />;
}

function Avatar({ k, emoji, color, size }: { k: string; emoji: string; color: string; size: number }) {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: size * 0.5, background: `radial-gradient(circle at 38% 32%, ${color}55, ${color}1a 70%, rgba(7,9,26,.5))` }}>{emoji}</div>;
  return <img src={`/crew/${k}.png`} alt="" onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
}

function FlightCard({ f }: { f: Flight }) {
  const [p, setP] = useState(f.from);
  useEffect(() => { const t = setTimeout(() => setP(f.to), 30); return () => clearTimeout(t); }, [f]);
  return (
    <div style={{ position: "absolute", left: p.x + "%", top: p.y + "%", transform: "translate(-50%,-50%)", transition: "left 1.05s cubic-bezier(.4,0,.2,1), top 1.05s cubic-bezier(.4,0,.2,1)", zIndex: 999, pointerEvents: "none" }}>
      <div style={{ padding: "4px 9px", borderRadius: 9, background: f.color, color: "#04030f", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", boxShadow: `0 6px 20px ${f.color}cc`, animation: "cs-flip .5s ease-in-out infinite alternate" }}>📄 {f.label}</div>
    </div>
  );
}

export default function CrewStage({ agents, flights, onRemove, dark = true, caption = "", feed = [] }: { agents: StageAgent[]; flights: Flight[]; onRemove?: (k: string) => void; dark?: boolean; caption?: string; feed?: ScreenItem[] }) {
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { feedRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [feed]);
  const running = agents.some((a) => a.status === "think" || a.status === "write");

  // 待命时在工位上下弹跳；偶尔两位搭子原地冒 💬 交流（不离开工位）
  const [chat, setChat] = useState<Record<string, number>>({});
  const ref = useRef(agents); ref.current = agents;
  useEffect(() => {
    const id = setInterval(() => {
      const idle = ref.current.filter((a) => a.status === "idle");
      if (idle.length >= 2 && Math.random() < 0.45) {
        const a = idle[Math.floor(Math.random() * idle.length)];
        const b = idle.filter((o) => o.key !== a.key)[Math.floor(Math.random() * (idle.length - 1))];
        if (b) { setChat({ [a.key]: Date.now() + 2400, [b.key]: Date.now() + 2400 }); return; }
      }
      setChat({});
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const lead = agents.find((a) => a.isLead);
  const scrInk = dark ? "#dbe8ff" : "#16335f";
  const scrMut = dark ? "#9fc2ff" : "#3a64a0";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* 实景背景 */}
      <RoomBg />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: dark ? "linear-gradient(180deg, rgba(4,6,20,.34), rgba(4,6,20,.5) 58%, rgba(4,6,20,.74))" : "linear-gradient(180deg, rgba(226,234,250,.3), rgba(226,234,250,.46) 58%, rgba(226,234,250,.64))" }} />

      {/* 工作中 → 向总负责(主席台)汇报的发光数据流连线 */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}>
        {lead && agents.map((a) => {
          const act = a.status === "think" || a.status === "write";
          if (!act || a.isLead) return null;
          return (
            <g key={a.key}>
              {/* 辉光晕 */}
              <line x1={a.x} y1={a.y} x2={lead.x} y2={lead.y} stroke={a.color} strokeWidth={1.6} strokeOpacity={0.16} strokeLinecap="round" />
              {/* 稳定细线 */}
              <line x1={a.x} y1={a.y} x2={lead.x} y2={lead.y} stroke={a.color} strokeWidth={0.45} strokeOpacity={0.45} />
              {/* 流动光脉（comet） */}
              <line x1={a.x} y1={a.y} x2={lead.x} y2={lead.y} stroke="#ffffff" strokeWidth={0.7} strokeOpacity={0.95} strokeDasharray="2 13" strokeLinecap="round" style={{ animation: "cs-comet 1s linear infinite" }} />
            </g>
          );
        })}
      </svg>

      {/* ◉ 融入式协同作战大屏（半透叠在舱内主屏区） */}
      <div style={{ position: "absolute", left: "7%", right: "7%", top: "6%", height: "40%", borderRadius: 12, background: dark ? "linear-gradient(180deg, rgba(8,16,42,.5), rgba(4,10,30,.58))" : "rgba(244,249,255,.72)", border: `1px solid ${dark ? "rgba(130,190,255,.6)" : "rgba(80,130,210,.5)"}`, boxShadow: `0 0 38px ${dark ? "rgba(70,130,255,.4)" : "rgba(90,140,230,.28)"}, inset 0 0 50px ${dark ? "rgba(40,100,230,.22)" : "rgba(150,180,240,.28)"}`, backdropFilter: "blur(1.5px)", overflow: "hidden", display: "flex", flexDirection: "column", zIndex: 6 }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${dark ? "rgba(110,170,255,.06)" : "rgba(80,130,210,.07)"} 1px, transparent 1px), linear-gradient(90deg, ${dark ? "rgba(110,170,255,.06)" : "rgba(80,130,210,.07)"} 1px, transparent 1px)`, backgroundSize: "30px 30px", animation: "cs-grid 7s linear infinite", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "7px 13px", borderBottom: `1px solid ${dark ? "rgba(130,190,255,.22)" : "rgba(80,130,210,.2)"}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: running ? "#34d399" : "#7aa8ff", boxShadow: `0 0 10px ${running ? "#34d399" : "#7aa8ff"}`, animation: running ? "cs-blink 1s infinite" : "none" }} />
          <b style={{ fontSize: 13, color: scrInk, letterSpacing: 1, textShadow: dark ? "0 0 10px rgba(120,180,255,.5)" : "none" }}>协同作战大屏</b>
          <span style={{ fontSize: 9, color: scrMut, letterSpacing: 2, opacity: .7 }}>MISSION&nbsp;CONTROL</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: scrMut, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{caption || (running ? "协同进行中…" : "待命")}</span>
            <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 14 }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 6 + (i % 3) * 3, background: running ? "#34d399" : scrMut, borderRadius: 1, animation: running ? `cs-eq .8s ${i * 0.12}s ease-in-out infinite` : "none", opacity: .85 }} />)}
            </span>
            <span style={{ fontSize: 9, fontWeight: 900, color: running ? "#ff5a6a" : scrMut, border: `1px solid ${running ? "#ff5a6a" : scrMut}`, borderRadius: 4, padding: "1px 4px", letterSpacing: 1 }}>● LIVE</span>
          </span>
        </div>
        <div ref={feedRef} style={{ position: "relative", flex: 1, overflowY: "auto", padding: "9px 13px", fontSize: 12.5, lineHeight: 1.7 }}>
          {feed.length === 0 && <div style={{ color: dark ? "#9fc2ff" : "#6a86b8", textAlign: "center", paddingTop: 22, textShadow: dark ? "0 0 12px rgba(80,140,255,.5)" : "none" }}>· 大屏待命 · 点「开始协作」，各工位的产出与交接将在此实时汇聚 ·</div>}
          {feed.map((it, i) => (
            <div key={i} style={{ marginBottom: 7, animation: "cs-feedin .4s ease both" }}>
              <span style={{ color: it.color, fontWeight: 800, textShadow: dark ? `0 0 8px ${it.color}99` : "none" }}>▍{it.who}</span>
              <span style={{ color: dark ? "#dbe6ff" : "#33405e" }}> {it.text}</span>
            </div>
          ))}
        </div>
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: `linear-gradient(90deg, transparent, ${dark ? "rgba(130,200,255,.6)" : "rgba(90,140,230,.5)"}, transparent)`, animation: "cs-scan 4s linear infinite" }} />
        {[["left", "top"], ["right", "top"], ["left", "bottom"], ["right", "bottom"]].map(([h, v], i) => <div key={i} aria-hidden style={{ position: "absolute", [h]: 6, [v]: 6, width: 14, height: 14, [`border${v === "top" ? "Top" : "Bottom"}`]: `2px solid ${dark ? "#82c0ff" : "#5a8de0"}`, [`border${h === "left" ? "Left" : "Right"}`]: `2px solid ${dark ? "#82c0ff" : "#5a8de0"}` }} />)}
      </div>

      {/* 飞行交接卡片 */}
      {flights.map((f) => <FlightCard key={f.id} f={f} />)}

      {/* 搭子工位（头像+座椅+控制台，一体随动） */}
      {agents.map((a) => {
        const work = a.status === "think" || a.status === "write";
        const p = { x: a.x, y: a.y };
        const chatting = a.status === "idle" && (chat[a.key] || 0) > Date.now();
        const size = a.isLead ? 76 : 64;
        const depth = p.y / 100;
        const sc = 0.9 + depth * 0.34;
        const deskW = size * 1.7;
        const zo = 10 + Math.round(p.y / 5) + (work ? 80 : a.isLead ? 6 : 0);
        const gold = a.isLead;
        const edge = work ? a.color : a.status === "done" ? "#34d399" : gold ? "#ffd24a" : `${a.color}aa`;
        const seatBg = gold ? "linear-gradient(180deg, #7a5c12 0%, #3a2a08 100%)" : "linear-gradient(180deg, #2a3358, #11162e)";
        const seatBorder = gold ? "#ffd24a" : `${a.color}66`;
        const seatGlow = gold ? "0 0 28px rgba(255,205,80,.55), 0 4px 14px #0007" : work ? `0 0 18px ${a.color}66` : "0 4px 12px #0007";
        const deskBg = gold ? "linear-gradient(180deg, #8a6614, #2e2208)" : "linear-gradient(180deg, #1a244a, #0a1024)";
        const barColor = gold ? "#ffd24a" : a.color;
        return (
          <div key={a.key} style={{ position: "absolute", left: p.x + "%", top: p.y + "%", transform: `translate(-50%,-50%) scale(${sc})`, width: 150, textAlign: "center", zIndex: zo }}>
            {onRemove && !a.isLead && !a.locked && a.status === "idle" && (
              <button onClick={(e) => { e.stopPropagation(); onRemove(a.key); }} title="移出团队"
                style={{ position: "absolute", left: `calc(50% - ${size / 2 + 2}px)`, top: 2, width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(255,120,130,.6)", background: "rgba(7,9,26,.85)", color: "#ff8a96", cursor: "pointer", fontSize: 13, lineHeight: 1, zIndex: 30, fontFamily: "inherit" }}>−</button>
            )}
            {/* 思考气泡 / 交流气泡 */}
            {a.status === "think" && (
              <div style={{ position: "absolute", left: "50%", top: -24, transform: "translateX(-50%)", padding: "5px 9px", borderRadius: 12, background: dark ? "rgba(255,255,255,.95)" : "rgba(20,30,52,.92)", boxShadow: "0 4px 14px #0007", display: "flex", gap: 4, zIndex: 22 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: a.color, animation: `cs-blink 1s ${i * 0.18}s infinite` }} />)}
              </div>
            )}
            {a.status === "idle" && chatting && <div style={{ position: "absolute", left: "50%", top: -20, transform: "translateX(-50%)", fontSize: 15, animation: "cs-pop .4s ease-out", zIndex: 22 }}>💬</div>}

            {/* 一体工位：座椅靠背 + 头像 + 控制台 */}
            <div style={{ position: "relative", width: deskW, height: deskW * 0.72, margin: "0 auto" }}>
              {/* 主席台金色基座 */}
              {gold && <div style={{ position: "absolute", left: "50%", bottom: -7, transform: "translateX(-50%)", width: deskW * 1.32, height: deskW * 0.3, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,205,80,.42), transparent 70%)", border: "1px solid rgba(255,210,90,.5)", zIndex: 0 }} />}
              {/* 座椅靠背（主席台金色加高） */}
              <div style={{ position: "absolute", left: "50%", top: gold ? -size * 0.12 : 0, transform: "translateX(-50%)", width: size * (gold ? 1.04 : 0.92), height: size * (gold ? 1.0 : 0.78), borderRadius: "46% 46% 18% 18%", background: seatBg, border: `${gold ? 2 : 1}px solid ${seatBorder}`, boxShadow: seatGlow, zIndex: 1 }} />
              {/* 头像（坐着）：外层负责居中(translateX)，内层做弹跳动画，避免动画 transform 覆盖居中导致偏右 */}
              <div style={{ position: "absolute", left: "50%", top: size * 0.16, transform: "translateX(-50%)", width: size, height: size, zIndex: 3 }}>
                <div style={{ position: "relative", width: size, height: size, animation: a.status === "write" ? "cs-type .5s ease-in-out infinite" : a.status === "done" ? "none" : "cs-bob 1s ease-in-out infinite" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: `2px solid ${edge}`, boxShadow: work ? `0 0 24px ${a.color}` : a.status === "done" ? "0 0 14px #34d399aa" : "0 4px 14px #0009" }}>
                    <Avatar k={a.key} emoji={a.emoji} color={a.color} size={size} />
                  </div>
                  {a.status === "done" && <div style={{ position: "absolute", right: -2, top: -2, width: 21, height: 21, borderRadius: "50%", background: "#34d399", color: "#04030f", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 900, animation: "cs-pop .4s ease-out", boxShadow: "0 2px 10px #34d399aa" }}>✓</div>}
                  {a.isLead && <div style={{ position: "absolute", left: "50%", top: -14, transform: "translateX(-50%)", fontSize: 15 }}>👑</div>}
                </div>
              </div>
              {/* 控制台桌面（在前方，弧形+霓虹边+小屏） */}
              <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%) perspective(300px) rotateX(50deg)", transformOrigin: "center bottom", width: deskW, height: deskW * 0.34, borderRadius: "12px 12px 7px 7px", background: deskBg, border: `1.5px solid ${edge}`, boxShadow: work ? `0 0 22px ${a.color}, inset 0 0 14px ${a.color}55` : gold ? "0 0 18px rgba(255,205,80,.4), inset 0 0 12px rgba(255,205,80,.3)" : `0 6px 16px #0008, inset 0 0 10px ${a.color}33`, zIndex: 4 }}>
                <div style={{ position: "absolute", left: "12%", right: "12%", top: "26%", height: 3, borderRadius: 2, background: barColor, opacity: work ? 1 : 0.55, animation: work ? "cs-data 1s ease-in-out infinite" : "none" }} />
                <div style={{ position: "absolute", left: "26%", right: "26%", top: "56%", height: 3, borderRadius: 2, background: barColor, opacity: work ? 0.8 : 0.4, animation: work ? "cs-data 1s .2s ease-in-out infinite" : "none" }} />
              </div>
            </div>

            <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 800, color: dark ? "#eaf1ff" : "#16233c", textShadow: dark ? "0 1px 6px #000, 0 0 10px #0008" : "0 1px 3px rgba(255,255,255,.7)" }}>{a.name}{a.isLead && " · 主席"}</div>
            <div style={{ fontSize: 10, minHeight: 12, color: a.status === "think" ? (dark ? "#cfe0ff" : "#2a64c0") : a.status === "write" ? (dark ? "#ffd9a0" : "#b06a00") : a.status === "done" ? (dark ? "#7ef0c0" : "#0a9466") : (dark ? "#9fb6e0" : "#5a6b86"), textShadow: dark ? "0 1px 6px #000" : "none" }}>
              {a.status === "think" ? "分析中…" : a.status === "write" ? "撰写中…" : a.status === "done" ? "完成 ✓" : chatting ? "交流中" : "在岗"}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes cs-sit{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes cs-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes cs-type{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-1.5px) rotate(1.5deg)}}
        @keyframes cs-blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes cs-data{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes cs-pop{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
        @keyframes cs-dash{to{stroke-dashoffset:-2.8}}
        @keyframes cs-comet{to{stroke-dashoffset:-15}}
        @keyframes cs-flip{from{transform:translateY(0)}to{transform:translateY(-4px)}}
        @keyframes cs-feedin{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes cs-scan{0%{transform:translateY(0)}100%{transform:translateY(2400%)}}
        @keyframes cs-grid{0%{background-position:0 0}100%{background-position:30px 30px}}
        @keyframes cs-eq{0%,100%{transform:scaleY(.5)}50%{transform:scaleY(1.4)}}
      `}</style>
    </div>
  );
}
