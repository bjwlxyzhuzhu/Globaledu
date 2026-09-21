"use client";
// 进入驾驶舱的「第一视角超空间穿梭」入场动画：星点从中心向外拉成光迹、加速后减速定格，
// 再淡出露出驾驶舱。可点「跳过」。由页面控制每个会话只放一次。纯 canvas，无依赖。
import { useEffect, useRef, useState } from "react";

export default function CockpitIntro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fade, setFade] = useState(false);
  const doneRef = useRef(false);

  const end = (delay: number) => { if (doneRef.current) return; doneRef.current = true; setFade(true); setTimeout(onDone, delay); };

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, cx = 0, cy = 0;
    const resize = () => { W = cv.width = Math.floor(innerWidth * DPR); H = cv.height = Math.floor(innerHeight * DPR); cx = W / 2; cy = H / 2; };
    resize(); addEventListener("resize", resize);

    const N = 340;
    const rnd = () => (Math.random() * 2 - 1);
    const stars = Array.from({ length: N }, () => { const z = Math.random() * W + 1; return { x: rnd() * W, y: rnd() * H, z, pz: z }; });
    const colors = ["#7fdcff", "#a78bfa", "#c9f0ff", "#ff9bd0"];
    const DUR = 2200;
    let raf = 0; const t0 = performance.now();

    const tick = (now: number) => {
      const el = now - t0; const p = Math.min(1, el / DUR);
      const speed = ((1 - p) * 46 + 4) * (W / 900);
      ctx.fillStyle = "rgba(2,2,10,0.34)"; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(cx, cy);
      const k = 150 * DPR;
      for (const s of stars) {
        s.pz = s.z; s.z -= speed;
        if (s.z < 1) { s.x = rnd() * W; s.y = rnd() * H; s.z = W; s.pz = s.z; }
        const sx = (s.x / s.z) * k, sy = (s.y / s.z) * k;
        const px = (s.x / s.pz) * k, py = (s.y / s.pz) * k;
        ctx.strokeStyle = colors[Math.abs(s.x | 0) % colors.length];
        ctx.globalAlpha = Math.min(1, (1 - s.z / W) + 0.12);
        ctx.lineWidth = Math.max(0.5, (1 - s.z / W) * 2.6) * DPR;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * (0.1 + p * 0.5));
      g.addColorStop(0, `rgba(150,190,255,${0.1 + p * 0.18})`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (el >= DUR) { end(520); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#02020a", opacity: fade ? 0 : 1, transition: "opacity .5s ease", pointerEvents: fade ? "none" : "auto" }}>
      <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 6, color: "#9fc2ff", marginBottom: 10, animation: "ci-in .8s ease both" }}>FIRST-PERSON HYPERSPACE</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", textShadow: "0 0 32px #7aa8ff", animation: "ci-in 1s ease both" }}>创业星舰 · 驾驶舱</div>
          <div style={{ fontSize: 13, color: "#cfe0ff", marginTop: 10, animation: "ci-in 1.5s ease both" }}>第一视角接入中…</div>
        </div>
      </div>
      <button onClick={() => end(300)}
        style={{ position: "absolute", right: 18, top: 16, padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(120,200,255,.4)", background: "rgba(7,9,26,.6)", color: "#cfe0ff", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", zIndex: 2 }}>跳过 →</button>
      <style>{`@keyframes ci-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
