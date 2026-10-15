"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 开场引导动画（第一视角沉浸式）：
 * ① 星际之门开启 + 高速穿越（warp 星流 + 同心门环）
 * ② 水系/火系能量在混沌中交错旋入中心
 * ③ 碰撞 → 大爆炸（白闪 + 冲击波）
 * ④ 炸裂分成左右两片星系（水系青蓝 / 火系橙红）旋转成形
 * ⑤ 尘埃落定，淡出进入主界面
 * 每个浏览器会话只自动播一次（sessionStorage），右上角可跳过。
 */
export default function IntroSequence({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fading, setFading] = useState(false);
  const [titleOn, setTitleOn] = useState(false);
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, 850);
  }

  useEffect(() => {
    // 本会话已看过 → 直接进入（不挡）
    try {
      if (sessionStorage.getItem("introDone")) { finish(); return; }
      sessionStorage.setItem("introDone", "1");
    } catch {}

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, cx = 0, cy = 0, DIAG = 0;
    const resize = () => {
      // 防御：部分无头/初始布局下 innerHeight 可能异常偏小，给个下限保证画布分辨率
      W = canvas.width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 360);
      H = canvas.height = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 600);
      cx = W / 2; cy = H / 2; DIAG = Math.hypot(W, H) / 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const galR = Math.min(W, H) * 0.26;
    const N = 520;
    const P = Array.from({ length: N }, (_, i) => {
      const col = i % 2; // 0 水系, 1 火系
      return {
        col,
        a0: (col ? 0 : Math.PI) + (Math.random() - 0.5) * 1.7,
        r0: (0.55 + Math.random() * 0.5) * DIAG,
        spin: (0.6 + Math.random() * 0.8) * (col ? 1 : -1),
        gcx: col ? 0.655 : 0.345, // 星系中心（占宽比例）
        gr: Math.pow(Math.random(), 0.62) * galR,
        garm: (i % 2) * Math.PI + (Math.random() - 0.5) * 0.5,
        sz: Math.random() * 1.6 + 0.7,
        x: cx, y: cy,
      };
    });
    const stars = Array.from({ length: 170 }, () => ({ a: Math.random() * 7, r: Math.random() * DIAG }));

    const GATE = 1.45, CHAOS_END = 3.3, BANG = 3.42, TOTAL = 6.5;
    let raf = 0, rot = 0;
    const start = performance.now();
    let last = start;

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(2,3,10," + (t < GATE ? 0.34 : 0.22) + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // ① 星际之门 + 穿越
      if (t < GATE + 0.2) {
        const gp = Math.min(t / GATE, 1);
        for (const s of stars) {
          s.r += (1 + (s.r / DIAG) * 6) * (40 + gp * 140) * dt;
          if (s.r > DIAG) { s.r = Math.random() * 20 + 4; s.a = Math.random() * 7; }
          const c = Math.cos(s.a), si = Math.sin(s.a);
          ctx.strokeStyle = "rgba(165,205,255," + 0.55 * (1 - gp * 0.5) + ")";
          ctx.lineWidth = 0.6 + (s.r / DIAG) * 2.2;
          ctx.beginPath();
          ctx.moveTo(cx + c * s.r * 0.82, cy + si * s.r * 0.82);
          ctx.lineTo(cx + c * s.r, cy + si * s.r);
          ctx.stroke();
        }
        for (let k = 0; k < 5; k++) {
          const rr = ((gp * gp) * DIAG * 1.5 + k * 100) % (DIAG * 1.1);
          const a = (1 - rr / (DIAG * 1.1)) * 0.7 * (1 - gp * 0.3);
          ctx.strokeStyle = "rgba(" + Math.round(80 + gp * 150) + "," + Math.round(205 - gp * 70) + ",255," + a + ")";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rr + 1, (rr + 1) * 0.9, 0, 0, 7);
          ctx.stroke();
        }
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 160 + gp * 240);
        cg.addColorStop(0, "rgba(200,230,255," + 0.5 * gp + ")");
        cg.addColorStop(1, "rgba(120,90,255,0)");
        ctx.fillStyle = cg;
        ctx.fillRect(0, 0, W, H);
      }

      // ②③④ 混沌交错 → 大爆炸 → 双星系
      if (t > 1.05) {
        rot += dt * 0.55;
        const inGalaxy = t > CHAOS_END;
        for (const p of P) {
          let alpha: number;
          if (!inGalaxy) {
            const cp = Math.min(Math.max((t - 1.05) / (CHAOS_END - 1.05), 0), 1);
            const e = cp * cp * (3 - 2 * cp);
            const r = p.r0 * (1 - e) + 8 * e;
            const ang = p.a0 + p.spin * e * 3.4;
            p.x = cx + Math.cos(ang) * r;
            p.y = cy + Math.sin(ang) * r * 0.92;
            alpha = Math.min(cp * 2.2, 1) * 0.85;
          } else {
            const ang = p.garm + p.gr * 0.02 + rot * (p.col ? -1 : 1);
            const gx = p.gcx * W + Math.cos(ang) * p.gr;
            const gy = cy + Math.sin(ang) * p.gr * 0.45;
            p.x += (gx - p.x) * 0.07;
            p.y += (gy - p.y) * 0.07;
            alpha = 0.9;
          }
          const rgb = p.col
            ? "255," + ((110 + p.sz * 28) | 0) + ",55"
            : ((60 + p.sz * 28) | 0) + ",200,255";
          ctx.fillStyle = "rgba(" + rgb + "," + alpha + ")";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.sz * (inGalaxy ? 1.4 : 1.1), 0, 7);
          ctx.fill();
        }
        if (inGalaxy) {
          for (const g of [[0.345, "120,210,255"], [0.655, "255,140,70"]] as [number, string][]) {
            const grd = ctx.createRadialGradient(g[0] * W, cy, 0, g[0] * W, cy, galR * 0.85);
            grd.addColorStop(0, "rgba(" + g[1] + ",0.45)");
            grd.addColorStop(1, "rgba(" + g[1] + ",0)");
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, H);
          }
        }
      }

      // ③ 大爆炸：白闪 + 冲击波
      if (t > 3.2 && t < 4.0) {
        const f = 1 - Math.abs(t - BANG) / 0.5;
        if (f > 0) {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "rgba(255,255,255," + f * 0.95 + ")";
          ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = "lighter";
        }
        if (t > BANG) {
          const sw = (t - BANG) * DIAG * 3;
          ctx.strokeStyle = "rgba(255,240,220," + Math.max(0, 1 - (t - BANG) / 0.55) + ")";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, sw, 0, 7);
          ctx.stroke();
        }
      }

      if (t >= TOTAL) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const titleTimer = setTimeout(() => setTitleOn(true), 3850);
    // 兜底：若 rAF 被节流（如标签页隐藏），也确保最终进入
    const fallback = setTimeout(finish, (TOTAL + 2) * 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(titleTimer);
      clearTimeout(fallback);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "#02030a",
        opacity: fading ? 0 : 1, transition: "opacity .85s ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          textAlign: "center", pointerEvents: "none",
          opacity: titleOn ? 1 : 0, transition: "opacity 1s ease", transform: titleOn ? "scale(1)" : "scale(.96)",
        }}
      >
        <div>
          <div style={{ fontSize: "min(8vw,52px)", fontWeight: 800, letterSpacing: 2,
            background: "linear-gradient(120deg,#22d3ee,#7c5cff 50%,#ff6b35)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            textShadow: "0 0 40px rgba(124,92,255,.4)" }}>
            双创AI星际
          </div>
          <div style={{ marginTop: 8, fontSize: 12, letterSpacing: 4, color: "#9aa6c8" }}>
            DOUBLE INNOVATION AI COSMOS
          </div>
        </div>
      </div>
      <button
        onClick={finish}
        style={{
          position: "absolute", top: 22, right: 24, padding: "8px 16px", borderRadius: 999,
          border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.06)",
          color: "#eef1fb", fontSize: 13, cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(6px)",
        }}
      >
        跳过 →
      </button>
    </div>
  );
}
