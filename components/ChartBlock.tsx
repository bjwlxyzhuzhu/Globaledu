"use client";
// 插件·图表生成（P3 真实功能）：解析模型输出的 ```chart JSON 块，前端纯 SVG 渲染柱状/折线/饼图。
// 零第三方依赖、断网可演示。供对话气泡使用：<RichMsg text={content} />。

export type ChartSpec = {
  type: "bar" | "line" | "pie";
  title?: string;
  labels: string[];
  series: { name?: string; data: number[] }[];
};

const COLORS = ["#22d3ee", "#ff6b35", "#a78bfa", "#34d399", "#f5a623", "#f472b6", "#38bdf8"];

function parseSpec(raw: string): ChartSpec | null {
  try {
    const j = JSON.parse(raw.trim());
    if (!j || !["bar", "line", "pie"].includes(j.type)) return null;
    if (!Array.isArray(j.labels) || !j.labels.length || !Array.isArray(j.series) || !j.series.length) return null;
    const series = j.series
      .filter((s: unknown): s is { name?: string; data: number[] } =>
        !!s && typeof s === "object" && Array.isArray((s as { data?: unknown }).data))
      .map((s: { name?: string; data: unknown[] }) => ({
        name: typeof s.name === "string" ? s.name : "",
        data: s.data.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)).slice(0, j.labels.length),
      }));
    if (!series.length) return null;
    return { type: j.type, title: typeof j.title === "string" ? j.title : "", labels: j.labels.map(String).slice(0, 12), series: series.slice(0, 4) };
  } catch { return null; }
}

/** 把一段文本按 ```chart 块切开 */
export function splitChartBlocks(text: string): ({ kind: "text"; content: string } | { kind: "chart"; spec: ChartSpec })[] {
  const out: ({ kind: "text"; content: string } | { kind: "chart"; spec: ChartSpec })[] = [];
  const re = /```chart\s*([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", content: text.slice(last, m.index) });
    const spec = parseSpec(m[1]);
    if (spec) out.push({ kind: "chart", spec });
    else out.push({ kind: "text", content: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", content: text.slice(last) });
  return out.length ? out : [{ kind: "text", content: text }];
}

export function ChartSVG({ spec }: { spec: ChartSpec }) {
  const W = 460, H = 240, PL = 44, PR = 14, PT = spec.title ? 30 : 14, PB = 34;
  const iw = W - PL - PR, ih = H - PT - PB;
  const n = spec.labels.length;
  const allVals = spec.series.flatMap((s) => s.data);
  const maxV = Math.max(...allVals, 1);
  const Y = (v: number) => PT + (1 - v / maxV) * ih;

  let body: React.ReactNode = null;
  if (spec.type === "pie") {
    const data = spec.series[0].data;
    const total = data.reduce((s, v) => s + Math.max(0, v), 0) || 1;
    const cx = W / 2 - 60, cy = PT + ih / 2, R = Math.min(ih, iw) / 2.4;
    let ang = -Math.PI / 2;
    body = (
      <>
        {data.map((v, i) => {
          const frac = Math.max(0, v) / total;
          const a0 = ang, a1 = ang + frac * 2 * Math.PI;
          ang = a1;
          const large = frac > 0.5 ? 1 : 0;
          const p = `M${cx},${cy} L${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} A${R},${R} 0 ${large} 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)} Z`;
          return <path key={i} d={p} fill={COLORS[i % COLORS.length]} opacity="0.85" stroke="rgba(0,0,0,.25)" />;
        })}
        {spec.labels.map((lb, i) => (
          <g key={i}>
            <rect x={cx + R + 26} y={PT + i * 18} width={10} height={10} rx={2} fill={COLORS[i % COLORS.length]} />
            <text x={cx + R + 40} y={PT + i * 18 + 9} fontSize="11" fill="#c8d2ee">{lb} · {spec.series[0].data[i] ?? 0}</text>
          </g>
        ))}
      </>
    );
  } else {
    const groups = spec.series.length;
    const slot = iw / n;
    const bw = Math.min(26, (slot * 0.7) / groups);
    body = (
      <>
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line x1={PL} y1={Y(maxV * r)} x2={W - PR} y2={Y(maxV * r)} stroke="rgba(255,255,255,.12)" strokeDasharray={r === 0 ? "" : "3 4"} />
            <text x={PL - 5} y={Y(maxV * r)} fontSize="10" fill="#9aa6c8" textAnchor="end" dominantBaseline="middle">{Math.round(maxV * r)}</text>
          </g>
        ))}
        {spec.labels.map((lb, i) => (
          <text key={i} x={PL + slot * i + slot / 2} y={H - PB + 16} fontSize="10.5" fill="#9aa6c8" textAnchor="middle">{lb.slice(0, 6)}</text>
        ))}
        {spec.type === "bar" && spec.series.map((s, si) =>
          s.data.map((v, i) => (
            <rect key={si + "-" + i}
              x={PL + slot * i + slot / 2 - (bw * groups) / 2 + si * bw + 1}
              y={Y(Math.max(0, v))} width={bw - 2} height={Math.max(1, PT + ih - Y(Math.max(0, v)))}
              rx={3} fill={COLORS[si % COLORS.length]} opacity="0.9" />
          )))}
        {spec.type === "line" && spec.series.map((s, si) => (
          <g key={si}>
            <polyline points={s.data.map((v, i) => `${PL + slot * i + slot / 2},${Y(v)}`).join(" ")}
              fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth="2.2" strokeLinejoin="round" />
            {s.data.map((v, i) => <circle key={i} cx={PL + slot * i + slot / 2} cy={Y(v)} r="3" fill={COLORS[si % COLORS.length]} />)}
          </g>
        ))}
        {spec.series.some((s) => s.name) && spec.series.map((s, si) => (
          <g key={"lg" + si}>
            <rect x={PL + si * 90} y={4} width={10} height={10} rx={2} fill={COLORS[si % COLORS.length]} />
            <text x={PL + si * 90 + 14} y={13} fontSize="10.5" fill="#c8d2ee">{s.name || `系列${si + 1}`}</text>
          </g>
        ))}
      </>
    );
  }

  return (
    <div style={{ border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, background: "rgba(6,10,26,.55)", padding: "8px 6px", margin: "8px 0" }}>
      {spec.title && <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: "center", color: "#dce6ff", marginBottom: 2 }}>📈 {spec.title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>{body}</svg>
    </div>
  );
}

/** 对话气泡通用渲染：文本 + 图表混排 */
export default function RichMsg({ text }: { text: string }) {
  const segs = splitChartBlocks(text);
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "chart"
          ? <ChartSVG key={i} spec={s.spec} />
          : <span key={i} style={{ whiteSpace: "pre-wrap" }}>{s.content}</span>
      )}
    </>
  );
}
