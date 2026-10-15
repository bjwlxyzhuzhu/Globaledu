"use client";
import { useEffect, useRef } from "react";

/** 重科幻第一视角 hyperspace 穿梭背景：星点自中心隧道向外拉成青紫光迹 + 中心辉光。
 *  纯 canvas、无依赖。与首页蓝色星系刻意区分（更快、更密、带隧道光）。 */
export default function WarpStarfield({ speed = 1.4 }: { speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, cx = 0, cy = 0, raf = 0;
    const N = 420;
    const mk = () => ({ x: (Math.random() - 0.5) * 2400, y: (Math.random() - 0.5) * 2400, z: Math.random() * 1000 + 1, pz: 1000 });
    const stars = Array.from({ length: N }, mk);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      if (!canvas || !ctx) return;
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2; cy = h / 2;
    }
    resize();
    window.addEventListener("resize", resize);
    function frame() {
      if (!ctx) return;
      ctx.fillStyle = "rgba(4,3,16,0.30)";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
      glow.addColorStop(0, "rgba(90,120,255,0.10)");
      glow.addColorStop(0.5, "rgba(150,80,255,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      const K = 230;
      for (const s of stars) {
        s.pz = s.z;
        s.z -= 7 * speed;
        if (s.z < 1) { Object.assign(s, mk()); s.z = 1000; s.pz = 1000; }
        const sx = cx + (s.x / s.z) * K, sy = cy + (s.y / s.z) * K;
        const px = cx + (s.x / s.pz) * K, py = cy + (s.y / s.pz) * K;
        const t = 1 - s.z / 1000;
        const a = Math.min(1, t * 1.3);
        ctx.strokeStyle = t > 0.7 ? `rgba(200,235,255,${a})` : t > 0.38 ? `rgba(120,180,255,${a})` : `rgba(165,120,255,${a})`;
        ctx.lineWidth = Math.max(0.5, t * 2.6);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [speed]);

  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
