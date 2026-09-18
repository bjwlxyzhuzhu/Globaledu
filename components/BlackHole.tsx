"use client";
// 宇宙黑洞「创业星舰」入口：右上角常驻（水系/火系两区都可见，独立于星系引擎）。
// 椭圆吸积盘 + 顶部引力透镜亮弧 + 内部漩涡螺旋 + 科技 HUD 环；尘埃与星球被卷入视界吞噬。
// 点击 → 俯冲坠入过场 → 进驾驶舱。纯 canvas，无依赖。
import { useEffect, useRef, useState } from "react";

/** 坠入黑洞的全屏过场：前向飞行星迹 + 中心黑核膨胀吞噬全屏，结束 onDone（再由驾驶舱播放出舱）。 */
function DivePlunge({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, cx = 0, cy = 0;
    const rs = () => { W = cv.width = Math.floor(innerWidth * DPR); H = cv.height = Math.floor(innerHeight * DPR); cx = W / 2; cy = H / 2; };
    rs(); addEventListener("resize", rs);
    const N = 420; const rnd = () => Math.random() * 2 - 1;
    const stars = Array.from({ length: N }, () => { const z = Math.random() * W + 1; return { x: rnd() * W, y: rnd() * H, z, pz: z }; });
    const colors = ["#ffd9a0", "#7fdcff", "#a78bfa", "#fff"];
    const DUR = 1250; const t0 = performance.now(); let raf = 0;
    const finish = () => { if (!doneRef.current) { doneRef.current = true; onDone(); } };
    // 安全兜底：即使 rAF 被后台标签页暂停（切走标签/低电量），也保证按时进入驾驶舱
    const safety = setTimeout(finish, DUR + 300);
    const tick = (now: number) => {
      const el = now - t0; const p = Math.min(1, el / DUR);
      const speed = (8 + p * 64) * (W / 900);
      ctx.fillStyle = "rgba(2,2,8,0.28)"; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(cx, cy); const k = 150 * DPR;
      for (const s of stars) {
        s.pz = s.z; s.z -= speed; if (s.z < 1) { s.x = rnd() * W; s.y = rnd() * H; s.z = W; s.pz = s.z; }
        const sx = (s.x / s.z) * k, sy = (s.y / s.z) * k, px = (s.x / s.pz) * k, py = (s.y / s.pz) * k;
        ctx.strokeStyle = colors[Math.abs(s.x | 0) % colors.length];
        ctx.globalAlpha = Math.min(1, (1 - s.z / W) + 0.1);
        ctx.lineWidth = Math.max(0.6, (1 - s.z / W) * 3) * DPR;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1;
      const rCore = Math.pow(p, 2.2) * Math.max(W, H) * 0.8;
      ctx.strokeStyle = "rgba(200,180,255,0.6)"; ctx.lineWidth = 7 * DPR; ctx.beginPath(); ctx.arc(cx, cy, rCore + 7 * DPR, 0, 6.283); ctx.stroke();
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx, cy, rCore, 0, 6.283); ctx.fill();
      if (el >= DUR) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { clearTimeout(safety); cancelAnimationFrame(raf); removeEventListener("resize", rs); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000" }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cfe0ff", fontSize: 14, letterSpacing: 4, pointerEvents: "none", textShadow: "0 0 20px #7aa8ff" }}>坠入创业星舰…</div>
    </div>
  );
}

export default function BlackHole({ onEnter }: { onEnter: () => void }) {
  const cref = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef(false);
  const [hover, setHover] = useState(false);
  const [diving, setDiving] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => { const f = () => setNarrow(innerWidth < 720); f(); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);

  const SZ = narrow ? 156 : 224;

  useEffect(() => {
    const cv = cref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = SZ * DPR; cv.height = SZ * DPR; ctx.scale(DPR, DPR);
    const cx = SZ / 2, cy = SZ / 2;
    const AY = 0.58;                        // 椭圆纵向压扁（倾斜吸积盘观感）
    const rHx = SZ * 0.165;                 // 视界横向半径
    const rDisk = SZ * 0.46;                // 吸积盘外缘
    const warm = ["#ffd9a0", "#ffb066", "#ff8a3d"];
    const cool = ["#7fdcff", "#a78bfa", "#c9a0ff"];
    const dust = [...warm, ...cool, "#ffffff"];
    type P = { a: number; r: number; sp: number; va: number; clr: string; sz: number };
    const mkP = (): P => ({ a: Math.random() * 6.283, r: rDisk * (0.6 + Math.random() * 0.72), sp: SZ * (0.0014 + Math.random() * 0.0036), va: 0.012 + Math.random() * 0.03, clr: dust[Math.random() * dust.length | 0], sz: Math.random() * 1.8 + 0.5 });
    const ps: P[] = Array.from({ length: 96 }, mkP);
    type Pl = { a: number; r: number; sp: number; va: number; clr: string; sz: number; flash: number };
    const pClr = ["#4fa3ff", "#ff7a59", "#34d399", "#c084fc", "#fbbf24", "#22d3ee"];
    const mkPl = (): Pl => ({ a: Math.random() * 6.283, r: rDisk * 1.06, sp: SZ * 0.0016, va: 0.012, clr: pClr[Math.random() * pClr.length | 0], sz: SZ * (0.034 + Math.random() * 0.03), flash: 0 });
    const planets: Pl[] = [];
    let spawnT = 50;
    let rot = 0, raf = 0;

    const tick = () => {
      ctx.clearRect(0, 0, SZ, SZ);
      rot += 0.016;
      const boost = hoverRef.current ? 1.8 : 1;

      // 外发光（椭圆）
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, AY);
      const halo = ctx.createRadialGradient(0, 0, rHx * 0.5, 0, 0, rDisk * 1.18);
      halo.addColorStop(0, "rgba(120,90,210,0)"); halo.addColorStop(0.5, "rgba(130,160,255,0.13)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, rDisk * 1.18, 0, 6.283); ctx.fill();
      ctx.restore();

      // 科技 HUD：旋转虚线椭圆环
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * 0.3); ctx.scale(1, AY);
      ctx.strokeStyle = "rgba(120,220,255,0.32)"; ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.arc(0, 0, rDisk * 1.04, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      // 科技 HUD：环上刻度（反向缓转）
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-rot * 0.5);
      for (let i = 0; i < 28; i++) { const an = i / 28 * 6.283; const x = Math.cos(an) * rDisk * 1.1, y = Math.sin(an) * rDisk * 1.1 * AY; ctx.fillStyle = i % 7 === 0 ? "rgba(150,230,255,0.85)" : "rgba(150,230,255,0.3)"; const s = i % 7 === 0 ? 2 : 1.4; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
      ctx.restore();

      // 吸积盘：多层倾斜椭圆环旋转
      for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * (k % 2 ? -0.5 : 0.5)); ctx.scale(1, AY);
        const rr = rHx * 1.4 + k * (rDisk - rHx * 1.4) / 4;
        ctx.strokeStyle = (k < 2 ? warm : cool)[k % 3]; ctx.globalAlpha = 0.55 - k * 0.08; ctx.lineWidth = 3.4 - k * 0.6;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.283); ctx.stroke(); ctx.restore();
      }
      ctx.globalAlpha = 1;

      // 内部漩涡螺旋臂（黑洞在转）
      const arms = 4, spins = 2.3;
      for (let a = 0; a < arms; a++) {
        ctx.beginPath(); let first = true;
        for (let t = 0; t <= 1; t += 0.05) {
          const ang = rot * 1.7 + a * (6.283 / arms) + t * spins * 6.283;
          const rad = rHx * 0.5 + (rDisk * 0.9 - rHx * 0.5) * (1 - t);
          const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * AY;
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(180,210,255,0.2)"; ctx.lineWidth = 1.4; ctx.stroke();
      }

      // 尘埃卷入
      for (const p of ps) {
        const near = 1 - p.r / rDisk; p.a += p.va * boost * (1 + near * 2.6); p.r -= p.sp * boost * (1 + near * 1.8);
        if (p.r < rHx * 0.85) { Object.assign(p, mkP()); continue; }
        const x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * AY;
        ctx.globalAlpha = Math.min(1, 0.25 + near); ctx.fillStyle = p.clr; ctx.beginPath(); ctx.arc(x, y, p.sz * (0.6 + near), 0, 6.283); ctx.fill();
        ctx.strokeStyle = p.clr; ctx.globalAlpha = 0.22 * near; ctx.lineWidth = p.sz * 0.8;
        const x2 = cx + Math.cos(p.a - 0.16) * (p.r + p.sp * 6), y2 = cy + Math.sin(p.a - 0.16) * (p.r + p.sp * 6) * AY;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 星球被吞噬（螺旋卷入 + 接近视界拉伸 + 闪没）
      spawnT -= 1; if (spawnT <= 0 && planets.length < 2) { planets.push(mkPl()); spawnT = 150 + Math.random() * 130; }
      for (let i = planets.length - 1; i >= 0; i--) {
        const pl = planets[i]; const near = 1 - pl.r / (rDisk * 1.06);
        const x = cx + Math.cos(pl.a) * pl.r, y = cy + Math.sin(pl.a) * pl.r * AY;
        if (pl.flash > 0 || pl.r < rHx * 0.95) {
          if (pl.flash === 0) pl.flash = 1;
          ctx.globalAlpha = pl.flash; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, pl.sz * pl.flash * 1.5, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
          pl.flash -= 0.13; if (pl.flash <= 0) planets.splice(i, 1); continue;
        }
        pl.a += pl.va * boost * (1 + near * 3); pl.r -= pl.sp * boost * (1 + near * 2.6);
        const stretch = 1 + near * near * 3.4;
        ctx.save(); ctx.translate(x, y); ctx.rotate(pl.a + Math.PI / 2); ctx.scale(stretch, 1 / Math.max(1, stretch * 0.55));
        ctx.fillStyle = pl.clr; ctx.beginPath(); ctx.arc(0, 0, pl.sz, 0, 6.283); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(-pl.sz * 0.3, -pl.sz * 0.3, pl.sz * 0.32, 0, 6.283); ctx.fill();
        ctx.restore();
      }

      // 顶部引力透镜亮弧（吸积盘被弯到黑核上方）
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, AY);
      ctx.strokeStyle = "rgba(255,201,140,0.9)"; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, 0, rHx * 1.2, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
      ctx.strokeStyle = "rgba(255,230,190,0.5)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, rHx * 1.34, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      ctx.restore();
      // 视界黑核 + 光子环
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, AY);
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, rHx, 0, 6.283); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(195,215,255,0.95)"; ctx.beginPath(); ctx.arc(0, 0, rHx * 1.05, 0, 6.283); ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [SZ]);

  const setH = (v: boolean) => { hoverRef.current = v; setHover(v); };

  return (
    <>
      <div
        id="blackhole"
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        onClick={() => { if (!diving) setDiving(true); }}
        title="创业星舰 · 点击坠入驾驶舱"
        style={{ position: "fixed", right: narrow ? "2.5%" : "3.5%", top: narrow ? "11%" : "7%", zIndex: 35, cursor: "pointer", textAlign: "center", transition: "transform .25s", transform: hover ? "scale(1.07)" : "scale(1)", filter: hover ? "drop-shadow(0 0 30px rgba(150,170,255,.75))" : "drop-shadow(0 0 16px rgba(120,140,255,.45))" }}
      >
        <canvas ref={cref} style={{ width: SZ, height: SZ, display: "block" }} />
        <div style={{ marginTop: -(SZ * 0.16), fontSize: narrow ? 12 : 14, fontWeight: 800, color: "#fff", textShadow: "0 0 14px #7aa8ff, 0 1px 4px #000", letterSpacing: 1 }}>创业星舰</div>
        <div style={{ fontSize: narrow ? 10 : 11.5, color: hover ? "#ffd9a0" : "#bcd0ff", textShadow: "0 1px 6px #000", marginTop: 1 }}>{hover ? "坠入黑洞 · 进驾驶舱 →" : "宇宙黑洞 · 入口"}</div>
      </div>
      {diving && <DivePlunge onDone={onEnter} />}
    </>
  );
}
