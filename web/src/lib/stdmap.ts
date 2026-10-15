// 自然资源部标准地图服务系统（bzdt.ch.mnr.gov.cn）下载的《中国地图》1:1000万（对开），
// 审图号 GS(2022)4312号。web/public/stdmap/ 下的 JPG 是原图（5825×7248）等比缩到 3600 宽，
// 内容未做任何修改——标准地图改动内容需重新送审，因此只缩放、不改色、不裁切。
export const CHINA_STDMAP = {
  url: '/stdmap/china-gs2022-4312.jpg',
  width: 3600,
  height: 4479,
  approval: 'GS(2022)4312号',
  source: '自然资源部 监制 · 标准地图服务系统',
};

// 省份热区与底图的配准参数：双标准纬线等积圆锥投影（25°N / 47°N，中央经线 105°E），
// 以 data/geo/china.json 的大陆部分对底图陆地做 IoU 拟合得出（IoU 0.944，叠图核对误差约 1–2 像素）。
// k/tx/ty 为 728 宽拟合图上的值，按 width/728 换算到实际底图尺寸。
const FIT = { lon0: 105, phi0: 25, phi1: 47, k: 964.0395982524723, tx: 396.5, ty: 409.8923500589195, fitWidth: 728 };

const rad = Math.PI / 180;
const sy0 = Math.sin(FIT.phi0 * rad);
const n = (sy0 + Math.sin(FIT.phi1 * rad)) / 2;
const c = 1 + sy0 * (2 * n - sy0);
const r0 = Math.sqrt(c) / n;
const f = CHINA_STDMAP.width / FIT.fitWidth;
// d3.geoConicEqualArea 默认 center 为 [0, 33.6442]，translate 对准的是该点，拟合参数沿用了这个约定
const yc = r0 - Math.sqrt(c - 2 * n * Math.sin(33.6442 * rad)) / n;

// 经纬度 → 标准底图像素坐标（与拟合时用的 d3.geoConicEqualArea 结果一致）
export function projectToStdmap(lng: number, lat: number): [number, number] {
  const lambda = (lng - FIT.lon0) * rad * n;
  const r = Math.sqrt(c - 2 * n * Math.sin(lat * rad)) / n;
  const x = r * Math.sin(lambda);
  const y = r0 - r * Math.cos(lambda);
  return [(FIT.tx + FIT.k * x) * f, (FIT.ty - FIT.k * (y - yc)) * f];
}
