import { useEffect, useRef } from 'react';
import { loadLeaflet } from '../lib/leaflet';
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
        map = L.map(elRef.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Esri' }).addTo(map);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.22 }).addTo(map);
        maskOutside(L, geojson).addTo(map);
        const layer = L.geoJSON(geojson, { style: { color: '#f5c542', weight: 1.4, fillColor: '#f5c542', fillOpacity: 0.22 } }).addTo(map);
        if (capital && Number.isFinite(capital.lat) && Number.isFinite(capital.lng)) {
          redDot(L, capital.lat, capital.lng, capital.label, () => onCapRef.current?.()).addTo(map);
        }
        try {
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
          const z = map.getZoom();
          map.setMinZoom(Math.max(2, Math.floor(z) - 1));
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

  return <div ref={elRef} className={className} />;
}
