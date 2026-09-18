import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { loadLeaflet } from '../lib/leaflet';
import { maskOutside, redDot } from '../lib/mapFocus';
import { centroidLat, centroidLng } from '../lib/tz';
import { CITY_EN, PROVINCE_CAPITAL } from '../lib/cnRegions';
import { regionColor } from '../lib/regionColor';
import { api } from '../lib/api';
import type { City, Province } from '@shared/types';

// 省内城市地图：真实地势瓦片 + 蒙版（只显示该省板块）+ 城市覆盖 + 省会红点 + 中英标注。
export default function ProvinceCities() {
  const { t } = useTranslation();
  const { province } = useParams();
  const nav = useNavigate();
  const navRef = useRef(nav);
  navRef.current = nav;
  const elRef = useRef<HTMLDivElement>(null);
  const [meta, setMeta] = useState<Province | null>(null);

  useEffect(() => {
    if (!province) return;
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    loadLeaflet()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(async (L: any) => {
        const provs = await api.provinces();
        if (!alive) return;
        const m = provs.find((p) => p.id === province) || null;
        if (m?.type === 'municipality' && m.cityId) {
          navRef.current(`/city/${m.cityId}`, { replace: true });
          return;
        }
        setMeta(m);
        if (!elRef.current) return;
        map = L.map(elRef.current, { center: [34, 108], zoom: 6, minZoom: 4, maxZoom: 10, zoomControl: false, attributionControl: true });
        L.control.zoom({ position: 'bottomleft' }).addTo(map);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Esri World Imagery' }).addTo(map);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.22 }).addTo(map);

        const [geo, cs] = await Promise.all([api.geo(province), api.cities(province)]);
        if (!alive) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = geo as any;
        // 蒙版：只显示该省板块
        maskOutside(L, g).addTo(map);

        const content = new Set(cs.filter((c: City) => c.hasContent).map((c: City) => c.name_zh));
        const layer = L.geoJSON(g, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: (f: any) => {
            const name = f?.properties?.name as string;
            const c = content.has(name);
            return c
              ? { color: '#f5c542', weight: 2.4, fillColor: regionColor(name), fillOpacity: 0.58 }
              : { color: 'rgba(210,225,255,0.75)', weight: 1, fillColor: regionColor(name), fillOpacity: 0.42 };
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onEachFeature: (f: any, lyr: any) => {
            const name = f?.properties?.name as string;
            const en = CITY_EN[name];
            lyr.on('mouseover', () => lyr.setStyle({ weight: 2.6, color: '#fff7d6', fillOpacity: 0.55 }));
            lyr.on('mouseout', () => layer.resetStyle(lyr));
            lyr.on('click', () => {
              const c = cs.find((x: City) => x.name_zh === name);
              if (c) navRef.current(`/city/${c.id}`);
              else navRef.current(`/city/place_${encodeURIComponent(name)}`);
            });
            lyr.bindTooltip(en ? `${name} · ${en}` : name, { sticky: true, className: 'hyxq-tip' });
          },
        }).addTo(map);

        // 省会红点
        const capName = m ? PROVINCE_CAPITAL[m.name_zh] : undefined;
        if (capName) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cap = (g.features as any[])?.find((f) => f?.properties?.name === capName);
          if (cap) {
            const en = CITY_EN[capName];
            redDot(L, centroidLat(cap.geometry), centroidLng(cap.geometry), `${capName.replace(/市$/, '')}${en ? ' ' + en : ''} · 省会`, () => {
              const cc = cs.find((x: City) => x.name_zh === capName);
              navRef.current(cc ? `/city/${cc.id}` : `/city/place_${encodeURIComponent(capName)}`);
            }).addTo(map);
          }
        }

        try {
          map.fitBounds(layer.getBounds(), { padding: [36, 36] });
          const z = map.getZoom();
          map.setMinZoom(Math.max(3, Math.floor(z) - 1));
          map.setMaxBounds(layer.getBounds().pad(0.45));
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
  }, [province]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="relative w-full h-screen overflow-hidden">
      <Hud />
      <BackButton to="/map/china" />
      <div className="absolute top-16 inset-x-0 text-center z-[600] pointer-events-none px-4">
        <h1 className="text-xl font-semibold text-glow">
          {meta ? meta.name_zh : t('pages.province')}
          {meta ? <span className="text-white/55 text-sm"> · {meta.name_en}</span> : null}
        </h1>
        <p className="text-xs text-white/75 mt-1">{t('map.hintCityAll')}</p>
      </div>
      <div ref={elRef} className="absolute inset-0 z-0" />
      <div className="absolute inset-0 z-[400] pointer-events-none" style={{ boxShadow: 'inset 0 0 200px 60px rgba(5,6,15,0.8)' }} />
    </motion.div>
  );
}
