import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { loadLeaflet } from '../lib/leaflet';
import { maskOutside, redDot } from '../lib/mapFocus';
import { centroidLat, centroidLng } from '../lib/tz';
import { PROVINCE_EN } from '../lib/cnRegions';
import { regionColor } from '../lib/regionColor';
import { api } from '../lib/api';
import type { Province } from '@shared/types';

// 中国省份地图：真实地势瓦片底图 + 蒙版（只显示中国板块）+ 省份覆盖 + 北京首都红点 + 中英标注。
export default function ChinaMap() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const navRef = useRef(nav);
  navRef.current = nav;
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    loadLeaflet()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(async (L: any) => {
        if (!alive || !elRef.current) return;
        map = L.map(elRef.current, { center: [34, 108], zoom: 4, minZoom: 3, maxZoom: 9, zoomControl: false, attributionControl: true });
        L.control.zoom({ position: 'bottomleft' }).addTo(map);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Esri World Imagery' }).addTo(map);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.22 }).addTo(map);

        const [geo, provs] = await Promise.all([api.geo('china'), api.provinces()]);
        if (!alive) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = geo as any;
        // 蒙版：只显示中国板块，其余压暗
        maskOutside(L, g).addTo(map);

        const content = new Set(provs.filter((p: Province) => p.hasContent).map((p: Province) => p.name_zh));
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
            const en = PROVINCE_EN[name];
            lyr.on('mouseover', () => lyr.setStyle({ weight: 2.6, color: '#fff7d6', fillOpacity: 0.55 }));
            lyr.on('mouseout', () => layer.resetStyle(lyr));
            lyr.on('click', () => {
              const p = provs.find((x: Province) => x.name_zh === name);
              if (p?.type === 'municipality' && p.cityId) navRef.current(`/city/${p.cityId}`);
              else if (p && p.type !== 'municipality') navRef.current(`/map/china/${p.id}`);
              else navRef.current(`/city/place_${encodeURIComponent(name)}`);
            });
            lyr.bindTooltip(en ? `${name} · ${en}` : name, { sticky: true, className: 'hyxq-tip' });
          },
        }).addTo(map);

        // 首都北京红点
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bj = (g.features as any[])?.find((f) => f?.properties?.name === '北京市');
        if (bj)
          redDot(L, centroidLat(bj.geometry), centroidLng(bj.geometry), '北京 Beijing · 首都', () =>
            navRef.current('/city/beijing'),
          ).addTo(map);

        try {
          map.fitBounds(layer.getBounds(), { padding: [30, 30] });
          const z = map.getZoom();
          map.setMinZoom(Math.max(2, Math.floor(z) - 1));
          map.setMaxBounds(layer.getBounds().pad(0.4));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* 加载失败不崩 */
      });
    return () => {
      alive = false;
      if (map) map.remove();
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="relative w-full h-screen overflow-hidden">
      <Hud />
      <BackButton to="/globe" label={t('common.backToGlobe')} />
      <div className="absolute top-16 inset-x-0 text-center z-[600] pointer-events-none px-4">
        <h1 className="text-xl font-semibold text-glow">{t('pages.chinaMap')}</h1>
        <p className="text-xs text-white/75 mt-1">{t('map.hintProvinceAll')}</p>
      </div>
      <button
        onClick={() => nav('/cities')}
        className="absolute top-[88px] left-1/2 -translate-x-1/2 z-[600] glass px-4 py-1.5 rounded-full text-xs hover:border-starcyan/60 transition"
      >
        🔎 {i18n.language === 'zh' ? '城市检索' : 'City Directory'}
      </button>
      <div ref={elRef} className="absolute inset-0 z-0" />
      <div className="absolute inset-0 z-[400] pointer-events-none" style={{ boxShadow: 'inset 0 0 200px 60px rgba(5,6,15,0.8)' }} />
    </motion.div>
  );
}
