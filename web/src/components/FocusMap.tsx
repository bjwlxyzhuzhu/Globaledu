import { useEffect, useRef } from 'react';
import { loadLeaflet } from '../lib/leaflet';
import { TIANDITU_APPROVAL, addBaseLayers, usingTianditu } from '../lib/tianditu';
import { maskOutside, redDot } from '../lib/mapFocus';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geojson: any; // 单个 Feature（国家/地区）或 FeatureCollection
  capital?: { lat: number; lng: number; label: string };
  onCapitalClick?: () => void; // 点击首都红点 → 与首都对话
  className?: string;
}

// 聚焦地图：真实地势瓦片 + 蒙版（只显示该区域板块）+ 可点击的首都红点。
export default function FocusMap({ geojson, capital, onCapitalClick, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const onCapRef = useRef(onCapitalClick);
  onCapRef.current = onCapitalClick;

  useEffect(() => {
    if (!geojson) return;
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    loadLeaflet()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((L: any) => {
        if (!alive || !elRef.current) return;
        // 滚轮缩放默认关（页面要能正常上下滚动），用左下角 +/- 按钮、双击或双指缩放
        map = L.map(elRef.current, { zoomControl: false, attributionControl: !usingTianditu, scrollWheelZoom: false });
        L.control.zoom({ position: 'bottomleft' }).addTo(map);
        addBaseLayers(L, map);
        maskOutside(L, geojson).addTo(map);
        // 天地图底图下不再自己描国界（外国轮廓数据在争议地区未必与标准地图一致），只留淡金色填充
        const style = usingTianditu
          ? { stroke: false, fillColor: '#f5c542', fillOpacity: 0.12 }
          : { color: '#f5c542', weight: 1.4, fillColor: '#f5c542', fillOpacity: 0.22 };
        const layer = L.geoJSON(geojson, { style, interactive: false }).addTo(map);
        if (capital && Number.isFinite(capital.lat) && Number.isFinite(capital.lng)) {
          redDot(L, capital.lat, capital.lng, capital.label, () => onCapRef.current?.()).addTo(map);
        }
        try {
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
          const z = map.getZoom();
          map.setMinZoom(Math.max(2, Math.floor(z) - 1));
          map.setMaxZoom(12);
          map.setMaxBounds(layer.getBounds().pad(0.5));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      alive = false;
      if (map) map.remove();
    };
  }, [geojson, capital]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={elRef} className="absolute inset-0" />
      {usingTianditu && (
        <div className="absolute bottom-1 right-1 z-[500] rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/80 pointer-events-none">
          审图号：{TIANDITU_APPROVAL} · 天地图
        </div>
      )}
    </div>
  );
}
