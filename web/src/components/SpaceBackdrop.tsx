import { useEffect, useRef } from 'react';

// 宇宙背景：星空 + 流星 + 月球（自转+公转）+ 太阳（发光+自转+公转），各带标注。
// mount 立即画一帧，预览（rAF 暂停）也能看到天体与标注；动画在真实浏览器里运行。
export default function SpaceBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let raf = 0;
    let lastMeteor = 0;
    type Star = { x: number; y: number; r: number; a: number; tw: number };
    type Meteor = { x: number; y: number; vx: number; vy: number; life: number; len: number };
    let stars: Star[] = [];
    let meteors: Meteor[] = [];

    const resize = () => {
      W = canvas.width = Math.floor(canvas.clientWidth * dpr);
      H = canvas.height = Math.floor(canvas.clientHeight * dpr);
      const count = Math.min(440, Math.round((W * H) / (9000 * dpr)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (Math.random() * 1.3 + 0.3) * dpr,
        a: 0.25 + Math.random() * 0.75,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const label = (x: number, y: number, text: string, color: string) => {
      ctx.save();
      ctx.font = `${12 * dpr}px 'Noto Sans SC', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(text).width + 16 * dpr;
      const h = 22 * dpr;
      const yy = Math.min(Math.max(y, 16 * dpr), H - 16 * dpr);
      ctx.fillStyle = 'rgba(8,12,30,0.72)';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, yy - h / 2, w, h, 11 * dpr);
      ctx.fill();
      ctx.strokeStyle = 'rgba(127,201,255,0.35)';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(text, x, yy + dpr);
      ctx.restore();
    };

    const drawMoon = (cx: number, cy: number, rot: number) => {
      const r = 34 * dpr;
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
      g.addColorStop(0, '#eef2f7');
      g.addColorStop(0.6, '#c7cdda');
      g.addColorStop(1, '#8b93a8');
      ctx.save();
      ctx.shadowColor = 'rgba(200,210,235,0.5)';
      ctx.shadowBlur = 24 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      // 自转：环形山随旋转
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(120,128,148,0.45)';
      const craters = [
        [-0.3, -0.1, 0.16],
        [0.2, 0.25, 0.12],
        [0.35, -0.25, 0.09],
        [-0.1, 0.35, 0.1],
        [0.05, -0.32, 0.08],
      ];
      for (const [dx, dy, cr] of craters) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r, cr * r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return r;
    };

    const drawSun = (cx: number, cy: number, rot: number, pulse: number) => {
      const r = 20 * dpr;
      const haloR = r * (6 + pulse * 1.6);
      const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, haloR);
      halo.addColorStop(0, `rgba(255,210,120,${0.42 + pulse * 0.18})`);
      halo.addColorStop(0.3, 'rgba(255,170,70,0.16)');
      halo.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
      // 自转 + 发光：光芒旋转
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = `rgba(255,200,110,${0.5 + pulse * 0.2})`;
      ctx.lineWidth = 2 * dpr;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
        ctx.lineTo(Math.cos(a) * r * (1.9 + pulse * 0.45), Math.sin(a) * r * (1.9 + pulse * 0.45));
        ctx.stroke();
      }
      ctx.restore();
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      core.addColorStop(0, '#fff7e6');
      core.addColorStop(0.5, '#ffd27a');
      core.addColorStop(1, '#ffb347');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
      return r;
    };

    const spawnMeteor = () => {
      const sp = (6 + Math.random() * 6) * dpr;
      meteors.push({
        x: Math.random() * W * 0.8,
        y: Math.random() * H * 0.4,
        vx: sp,
        vy: sp * (0.45 + Math.random() * 0.4),
        life: 1,
        len: (80 + Math.random() * 90) * dpr,
      });
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * 0.001 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = '#dfe8ff';
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const cx = W / 2;
      const cy = H / 2;
      // 月亮公转（绕地球中心椭圆轨道）+ 自转
      const ma = 3.6 + t * 0.00009;
      const mx = cx + Math.cos(ma) * W * 0.4;
      const my = cy + Math.sin(ma) * H * 0.4;
      // 太阳公转（更远更慢）+ 自转 + 发光脉动
      const sa = 0.35 + t * 0.00005;
      const sx = cx + Math.cos(sa) * W * 0.47;
      const sy = cy + Math.sin(sa) * H * 0.46;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.002);

      const sr = drawSun(sx, sy, t * 0.0006, pulse);
      label(sx, sy + sr + 16 * dpr, '☀ 太阳 · Sun', '#ffd27a');
      const mr = drawMoon(mx, my, t * 0.0003);
      label(mx, my + mr + 16 * dpr, '☾ 月亮 · Moon', '#cfd8ea');

      for (const m of meteors) {
        m.x += m.vx;
        m.y += m.vy;
        m.life -= 0.012;
        const norm = Math.hypot(m.vx, m.vy) || 1;
        const tx = m.x - (m.vx / norm) * m.len;
        const ty = m.y - (m.vy / norm) * m.len;
        const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
        grad.addColorStop(0, `rgba(255,255,255,${Math.max(0, m.life)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      meteors = meteors.filter((m) => m.life > 0 && m.x < W + 200 && m.y < H + 200);
    };

    resize();
    draw(0);
    const loop = (t: number) => {
      draw(t);
      if (t - lastMeteor > 1600 + Math.random() * 1800) {
        spawnMeteor();
        lastMeteor = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className={className} />;
}
