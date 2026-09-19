// 生成 data/geo/cn-disputed.json，并把这些争议地区从 world.json 的各国板块中扣除。
//
// 依据《地球地图界面标注规范清单》「国际争议地区」：克里米亚、克什米尔、巴勒斯坦地区、
// 科索沃、南奥塞梯、阿布哈兹、纳卡，均要求「争议控制线虚线」且「不做单方面归属定性」。
//
// 做法：把这些区域从任何国家板块里扣掉，单独成层、中性配色、虚线描边、只标地名。
// 这样任何一块争议地都不会继承某国的颜色或轮廓，相邻处自然形成虚线分界。
//
// 例外：藏南与阿克赛钦属规范「中国领土区域（强制）」，实线划入中国，不在此列。
//
// 用法：
//   npm i --no-save polygon-clipping     # 仅本脚本需要，未写进 package.json，
//                                        # 以免动到 pnpm-lock 影响 Docker 构建
//   node scripts/gen-cn-disputed.mjs
//
// 注意：本脚本会就地改写 data/geo/world.json（把争议区从各国板块扣除），
// 不是幂等的读-写；重跑前请从 outputs/ 的备份恢复，否则会在已扣除的数据上再扣一次。
import polygonClipping from 'polygon-clipping';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (p) => path.join(ROOT, p);

const src = JSON.parse(readFileSync(P('data/geo/ne-disputed-src.json'), 'utf8'));
const world = JSON.parse(readFileSync(P('data/geo/world.json'), 'utf8'));

const multi = (f) =>
  f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
const setGeom = (f, c) => {
  f.geometry = c.length === 1
    ? { type: 'Polygon', coordinates: c[0] }
    : { type: 'MultiPolygon', coordinates: c };
};

// 外环顺时针、内环逆时针（与 Natural Earth 底图一致）。方向反了 globe.gl 会把内外判反。
const ringSign = (r) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s / 2;
};
const normalize = (coords) =>
  coords.map((poly) => poly.map((ring, i) => (ringSign(ring) < 0) === (i === 0) ? ring : [...ring].reverse()));

const centroid = (ring) => [
  ring.reduce((a, c) => a + c[0], 0) / ring.length,
  ring.reduce((a, c) => a + c[1], 0) / ring.length,
];

// ── 1. 从相关国家板块中扣除争议地区 ──────────────────────────────────
// 只动与争议区真正相交的国家。早前试过对全部 175 个板块统一做差集，
// 结果无关国家的环也被重排，且 10m 争议区与 110m 国界精度不一致会留下碎片。
const bbox = (coords) => {
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  for (const poly of coords) for (const c of poly[0]) {
    if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
    if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
  }
  return [x0, y0, x1, y1];
};
const overlaps = (a, b) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);

const R = 6371.0088;
const ringArea = (ring) => {
  let t = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j].map((v) => (v * Math.PI) / 180);
    const [x2, y2] = ring[i].map((v) => (v * Math.PI) / 180);
    t += (x2 - x1) * (2 + Math.sin(y1) + Math.sin(y2));
  }
  return Math.abs((t * R * R) / 2);
};
const areaOf = (c) => c.reduce((a, p) => a + p.reduce((b, r, i) => b + (i === 0 ? ringArea(r) : -ringArea(r)), 0), 0);

const cutBoxes = src.features.map((f) => ({ f, box: bbox(multi(f)) }));
const touched = [];
const removed = [];

for (const f of [...world.features]) {
  const fb = bbox(multi(f));
  const hits = cutBoxes.filter((c) => overlaps(fb, c.box));
  if (!hits.length) continue; // 绝大多数国家在此直接跳过，完全不动

  const cut = hits.reduce((acc, c) => (acc ? polygonClipping.union(acc, multi(c.f)) : multi(c.f)), null);
  let geom;
  try {
    geom = polygonClipping.difference(multi(f), cut);
  } catch {
    continue;
  }
  const kept = geom.length ? areaOf(geom) : 0;
  const orig = areaOf(multi(f));
  // 整块都是争议区的（科索沃、巴勒斯坦），残留不足一成即视为已被完全取代
  if (kept / orig < 0.1) {
    world.features.splice(world.features.indexOf(f), 1);
    removed.push(f.properties.NAME);
    continue;
  }
  setGeom(f, normalize(geom));
  touched.push(`${f.properties.NAME}(-${Math.round(orig - kept).toLocaleString()}km²)`);
}

// ── 2. 生成争议地区图层 ──────────────────────────────────────────────
const features = [];
const labels = [];
for (const f of src.features) {
  const coords = normalize(multi(f));
  features.push({
    type: 'Feature',
    properties: { kind: 'disputed', id: f.properties.id, zh: f.properties.zh, en: f.properties.en },
    geometry: coords.length === 1
      ? { type: 'Polygon', coordinates: coords[0] }
      : { type: 'MultiPolygon', coordinates: coords },
  });
  const biggest = coords.reduce((a, p) => (p[0].length > a[0].length ? p : a), coords[0]);
  const c = centroid(biggest[0]);
  // 争议地名一律 near 级：规范要求「全局小比例尺隐藏争议地区小字注记」
  labels.push({ id: f.properties.id, zh: f.properties.zh, en: f.properties.en, lng: c[0], lat: c[1], scope: 'near' });
}
// 巴勒斯坦地区：加沙与约旦河西岸的统称，规范要求单列该注记
labels.push({ id: 'palestine', zh: '巴勒斯坦地区', en: 'Palestinian Territories', lng: 35.2, lat: 31.95, scope: 'near' });
// 克什米尔总注记：拉远时代表整片，避免三块小字压盖
labels.push({ id: 'kashmir', zh: '克什米尔', en: 'Kashmir', lng: 76.0, lat: 34.2, scope: 'near' });

writeFileSync(P('data/geo/cn-disputed.json'), JSON.stringify({ type: 'FeatureCollection', labels, features }));
writeFileSync(P('data/geo/world.json'), JSON.stringify(world));

console.log(`争议区 ${features.length} 个 · 注记 ${labels.length} 条`);
console.log(`world.json 受影响板块 ${touched.length} 个：${touched.join('、') || '无'}`);
console.log(`已被争议区完全取代而删除：${removed.join('、') || '无'}`);
console.log(`要素数 → ${world.features.length}`);
