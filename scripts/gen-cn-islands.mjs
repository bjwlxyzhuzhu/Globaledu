// 从 data/geo/china.json（阿里云 DataV.GeoAtlas 官方数据）抽取南海断续线、
// 南海诸岛与钓鱼岛及其附属岛屿，生成 data/geo/cn-islands.json。
// 所有坐标均来自官方数据，不手写任何一个。
//
// 用法：node scripts/gen-cn-islands.mjs
//
// 注意：cn-islands.json 是生成物，不要手改坐标。china.json 更新后重跑本脚本即可。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const china = JSON.parse(readFileSync(path.join(ROOT, 'data/geo/china.json'), 'utf8'));

const byName = (n) => china.features.find((f) => (f.properties.name || '') === n);
const parts = (f) =>
  f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];

// 环绕方向归一化：外环顺时针（与 Natural Earth 底图一致）。
// DataV 原数据是逆时针，方向反了 globe.gl 会把球面内外判反，整个地球渲染成金色圆盘。
const ringSign = (r) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s / 2;
};
const cw = (ring) => (ringSign(ring) < 0 ? ring : [...ring].reverse());
const normPoly = (poly) => poly.map((ring, i) => (i === 0 ? cw(ring) : cw(ring).reverse()));

const centroid = (ring) => {
  const n = ring.length;
  return [ring.reduce((a, c) => a + c[0], 0) / n, ring.reduce((a, c) => a + c[1], 0) / n];
};

const features = [];

// ── 1. 南海断续线：china.json 里 adchar === 'JD' 的要素 ──────────────
// 实际是 10 段（比常说的九段多台湾以东那一段），这是 DataV 官方数据的原样，
// 也是 2023 年版标准地图的画法。
const jd = china.features.find((f) => f.properties.adchar === 'JD');
if (!jd) throw new Error('china.json 中未找到断续线要素（adchar=JD）');
parts(jd).forEach((poly, i) => {
  features.push({
    type: 'Feature',
    properties: { kind: 'dash', index: i, name_zh: '南海断续线', name_en: 'Nine-dash Line' },
    geometry: { type: 'LineString', coordinates: poly[0] },
  });
});
const dashCount = parts(jd).length;

// ── 2. 南海诸岛：海南省第 1 块起全部 + 广东省东沙群岛 ────────────────
// 海南省第 0 块是海南岛本身，从第 1 块起才是南海各岛礁。
const hainan = parts(byName('海南省')).slice(1);
// 东沙群岛：广东省诸块中位置孤悬东南（约 116.7°E / 20.7°N）的那一块。
const dongsha = parts(byName('广东省')).filter((p) => {
  const [lng, lat] = centroid(p[0]);
  return lng > 116 && lat < 21;
});
if (dongsha.length !== 1) throw new Error('东沙群岛识别失败：' + dongsha.length);

for (const poly of [...hainan, ...dongsha]) {
  features.push({
    type: 'Feature',
    // 带 ISO_A2: 'CN'，让地球仪把它与中国同为金色、点击同样进省份地图
    properties: { kind: 'island', group: 'nanhai', ISO_A2: 'CN', NAME: 'China' },
    geometry: { type: 'Polygon', coordinates: normPoly(poly) },
  });
}
const islandCount = hainan.length + dongsha.length;

// ── 3. 钓鱼岛及其附属岛屿：台湾省中经度 > 123° 的块 ──────────────────
// 按经度筛选而不写死块号，china.json 更新后不会错位。
const diaoyu = parts(byName('台湾省')).filter((p) => p[0].every((c) => c[0] > 123));
if (diaoyu.length !== 3) throw new Error('钓鱼岛识别失败：' + diaoyu.length);
for (const poly of diaoyu) {
  features.push({
    type: 'Feature',
    properties: { kind: 'island', group: 'diaoyu', ISO_A2: 'CN', NAME: 'China' },
    geometry: { type: 'Polygon', coordinates: normPoly(poly) },
  });
}

// ── 4. 注记锚点（按相机高度分级，避免互相压盖）────────────────────────
// 整球视角下西沙与中沙实际质心只差约 4° 经度（屏幕约 30px），而标签宽约 70px，
// 必然压盖，因此像纸质地图那样按比例尺分级：拉远只显示总注记，拉近才展开分组。
// 这与《地球地图界面标注规范清单》的交互规则一致：
// 「全局小比例尺只显示国家名称，放大至指定层级才加载注记」。
//
// 除南海诸岛外，这里还承载规范清单「中国领土区域（强制）」要求的文字标注：
// 台湾省、钓鱼岛、赤尾屿、藏南地区、阿克赛钦。
const taiwanMain = parts(byName('台湾省')).filter((p) => p[0].some((c) => c[0] < 123));
const twAnchor = centroid(
  taiwanMain.reduce((a, p) => (p[0].length > a[0].length ? p : a), taiwanMain[0])[0],
);

const labels = [
  // —— 中国领土区域（强制）——
  { id: 'taiwan', zh: '台湾省', en: 'Taiwan Province', lng: twAnchor[0], lat: twAnchor[1], scope: 'near' },
  // 赤尾屿单独标注：规范清单明确要求，与钓鱼岛分列
  { id: 'chiwei', zh: '赤尾屿', en: 'Chiwei Islet', lng: 124.568, lat: 25.922, scope: 'near' },
  // 藏南与阿克赛钦：边界已划入中国，此处补规范要求的地名注记。
  // 严禁使用印度单方面地名，故只标「藏南地区」。
  { id: 'zangnan', zh: '藏南地区', en: 'Zangnan', lng: 93.5, lat: 28.0, scope: 'near' },
  { id: 'aksai', zh: '阿克赛钦', en: 'Aksai Chin', lng: 79.12, lat: 34.84, scope: 'near' },
  // —— 南海诸岛 ——
  { id: 'nanhai', zh: '南海诸岛', en: 'South China Sea Islands', lng: 114.0, lat: 12.5, scope: 'far' },
  { id: 'dongsha', zh: '东沙群岛', en: 'Dongsha Islands', lng: 116.72, lat: 20.70, scope: 'near' },
  // 西沙与中沙的锚点做了错开，两个点都仍在各自群岛的实际范围内
  { id: 'xisha', zh: '西沙群岛', en: 'Xisha Islands', lng: 111.6, lat: 16.9, scope: 'near' },
  { id: 'zhongsha', zh: '中沙群岛', en: 'Zhongsha Islands', lng: 115.9, lat: 15.0, scope: 'near' },
  { id: 'nansha', zh: '南沙群岛', en: 'Nansha Islands', lng: 114.5, lat: 10.0, scope: 'near' },
  // 钓鱼岛三块彼此只隔 20–110 公里，任何缩放下分开标注都会压盖，固定用一个注记
  { id: 'diaoyu', zh: '钓鱼岛', en: 'Diaoyu Islands', lng: 123.478, lat: 25.744, scope: 'both' },
];

const out = { type: 'FeatureCollection', labels, features };
const dest = path.join(ROOT, 'data/geo/cn-islands.json');
writeFileSync(dest, JSON.stringify(out));

const outerRings = features.filter((f) => f.geometry.type === 'Polygon').length;
console.log(`断续线 ${dashCount} 段 · 南海诸岛 ${islandCount} 个 · 钓鱼岛 ${diaoyu.length} 个`);
console.log(`外环 ${outerRings} 个（应全部顺时针）· ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`);
console.log('→ data/geo/cn-islands.json');
