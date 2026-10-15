// 天地图（国家地理信息公共服务平台，自然资源部主办）：底图带国界、省界与南海断续线，审图号见 TIANDITU_APPROVAL。
// key 在构建时由 web/.env 的 VITE_TIANDITU_KEY 注入（浏览器端 key，本来就公开，靠控制台的域名白名单限制）。
export const TDT_KEY = (import.meta.env.VITE_TIANDITU_KEY as string | undefined)?.trim();
export const TIANDITU_APPROVAL = 'GS（2026）4921号';
export const usingTianditu = !!TDT_KEY;

// 球面墨卡托（_w）图层：vec 矢量 / img 影像 / cia 影像注记 / ibo 全球境界
export type TdtLayer = 'vec' | 'img' | 'cia' | 'ibo';
export const tdtTile = (layer: TdtLayer, x: number, y: number, l: number) =>
  `https://t${(x + y) % 8}.tianditu.gov.cn/DataServer?T=${layer}_w&x=${x}&y=${y}&l=${l}&tk=${TDT_KEY}`;
// Leaflet 模板形式，{s} 取 0–7 子域
export const tdtLeafletUrl = (layer: TdtLayer) =>
  `https://t{s}.tianditu.gov.cn/DataServer?T=${layer}_w&x={x}&y={y}&l={z}&tk=${TDT_KEY}`;

// Leaflet 底图：有 key 时用天地图 影像 + 境界 + 影像注记（界线以底图为准）；
// 没配 key 时退回原来的 Esri 影像，保证页面照常能打开——但那种情况下不符合标准地图要求。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addBaseLayers(L: any, map: any): void {
  if (TDT_KEY) {
    const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7'];
    for (const layer of ['img', 'ibo', 'cia'] as const) {
      L.tileLayer(tdtLeafletUrl(layer), { subdomains, maxZoom: 18 }).addTo(map);
    }
    return;
  }
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Esri World Imagery' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.22 }).addTo(map);
}
