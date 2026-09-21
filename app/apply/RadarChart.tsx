"use client";

/** 纯 SVG 雷达图：每轴 score/max 归一化绘制。无第三方依赖。 */
export default function RadarChart({
  axes, size = 320, accent = "#ff6b35",
}: { axes: { label: string; score: number; max: number }[]; size?: number; accent?: string }) {
  const cx = size / 2, cy = size / 2, R = size * 0.3;
  const N = Math.max(axes.length, 3);
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i: number, r: number): [number, number] => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const ratio = (a: { score: number; max: number }) => Math.max(0, Math.min(1, a.max ? a.score / a.max : 0));
  const dataPts = axes.map((a, i) => pt(i, R * ratio(a)));
  const poly = (r: number) => axes.map((_, i) => pt(i, r).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: size, display: "block", margin: "0 auto" }}>
      {[0.25, 0.5, 0.75, 1].map((rr, k) => (
        <polygon key={k} points={poly(R * rr)} fill="none" stroke="rgba(255,255,255,.12)" />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R);
        const [lx, ly] = pt(i, R + 18);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,.12)" />
            <text x={lx} y={ly} fontSize="11" fill="#9aa6c8" textAnchor="middle" dominantBaseline="middle">{a.label}</text>
            <text x={lx} y={ly + 13} fontSize="10" fontWeight="700" fill={accent} textAnchor="middle">{a.score}/{a.max}</text>
          </g>
        );
      })}
      <polygon points={dataPts.map((p) => p.join(",")).join(" ")} fill={`${accent}33`} stroke={accent} strokeWidth="2" />
      {dataPts.map((p, i) => (<circle key={i} cx={p[0]} cy={p[1]} r="3.2" fill={accent} />))}
    </svg>
  );
}
