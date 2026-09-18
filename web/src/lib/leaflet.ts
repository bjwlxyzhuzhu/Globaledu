// Leaflet 改为本地打包，不再从 CDN 运行时加载。
// 原实现从 cdn.jsdelivr.net 拉 leaflet.js/css，注释里写着「国内可达」，
// 但实测校园网与 WebVPN 下 jsdelivr 直接连不上（几十到几百毫秒即失败），
// 于是中国地图/省份地图/聚焦地图三处全部打不开。
// 现在由 Vite 打进主包，离线可用，也不受外网可达性影响。
// Leaflet 1.9 的 ESM 产物只有具名导出，没有 default，故用命名空间导入。
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 保持原有的异步签名，调用方（ChinaMap / ProvinceCities / FocusMap / mapFocus）无需改动。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let p: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadLeaflet(): Promise<any> {
  if (!p) {
    // 有些旧代码可能仍读 window.L，这里一并挂上，避免遗漏。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).L = L;
    p = Promise.resolve(L);
  }
  return p;
}
