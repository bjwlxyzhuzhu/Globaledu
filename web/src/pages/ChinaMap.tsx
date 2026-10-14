import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { loadLeaflet } from '../lib/leaflet';
import { PROVINCE_EN } from '../lib/cnRegions';
import { CHINA_STDMAP, projectToStdmap } from '../lib/stdmap';
import { api } from '../lib/api';
import type { Province } from '@shared/types';

// china.json 里南海断续线是一个没有名字的要素（adcode 100000_JD，JD = 九段）。
// 标准底图上已经画有断续线与南海诸岛，这里不再叠加，也不作为可点击热区。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isNanhai = (f: any): boolean =>
  f?.properties?.adcode === '100000_JD' || f?.properties?.adchar === 'JD';

// 中国省份地图：底图直接使用自然资源部标准地图（审图号 GS(2022)4312号），原样显示、不改内容。
// 省份只做透明热区（悬停淡亮、点击进入），不描边、不填色，避免在标准地图上另画一套界线。
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
        const { width: W, height: H } = CHINA_STDMAP;
        // 平面坐标系：1 单位 = 底图 1 像素；Leaflet 的 lat 向上，故 y 取负
        const bounds = L.latLngBounds([-H, 0], [0, W]);
        map = L.map(elRef.current, {
          crs: L.CRS.Simple,
          minZoom: -4,
          maxZoom: 1,
          zoomSnap: 0.25,
          zoomControl: false,
          attributionControl: false,
          maxBounds: bounds.pad(0.15),
        });
        L.control.zoom({ position: 'bottomleft' }).addTo(map);
        L.imageOverlay(CHINA_STDMAP.url, bounds).addTo(map);
        // 顶部留出标题/城市检索按钮的高度，底部留出审图号条
        map.fitBounds(bounds, { paddingTopLeft: [20, 130], paddingBottomRight: [20, 50] });
        map.setMinZoom(map.getZoom() - 0.5);

        const [geo, provs] = await Promise.all([api.geo('china'), api.provinces()]);
        if (!alive) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = geo as any;
        const hotspots = {
          ...g,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          features: (g.features as any[]).filter((f) => !isNanhai(f) && f?.properties?.name),
        };

        const idle = { stroke: false, fillColor: '#ffffff', fillOpacity: 0 };
        const hover = { stroke: false, fillColor: '#fff3b0', fillOpacity: 0.35 };
        L.geoJSON(hotspots, {
          coordsToLatLng: (c: number[]) => {
            const [x, y] = projectToStdmap(c[0], c[1]);
            return L.latLng(-y, x);
          },
          style: () => idle,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onEachFeature: (f: any, lyr: any) => {
            const name = f?.properties?.name as string;
            const en = PROVINCE_EN[name];
            lyr.on('mouseover', () => lyr.setStyle(hover));
            lyr.on('mouseout', () => lyr.setStyle(idle));
            lyr.on('click', () => {
              const p = provs.find((x: Province) => x.name_zh === name);
              if (p?.type === 'municipality' && p.cityId) navRef.current(`/city/${p.cityId}`);
              else if (p && p.type !== 'municipality') navRef.current(`/map/china/${p.id}`);
              else navRef.current(`/city/place_${encodeURIComponent(name)}`);
            });
            lyr.bindTooltip(en ? `${name} · ${en}` : name, { sticky: true, className: 'hyxq-tip' });
          },
        }).addTo(map);
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
      <div ref={elRef} className="absolute inset-0 z-0" style={{ background: '#0b1026' }} />
      {/* 审图号常驻：底图图例里也有，但放大平移后可能移出视野，这里固定显示 */}
      <div className="absolute bottom-3 right-3 z-[600] glass rounded-lg px-3 py-1.5 text-[11px] text-white/85 pointer-events-none">
        审图号：{CHINA_STDMAP.approval} · {CHINA_STDMAP.source}
      </div>
    </motion.div>
  );
}
