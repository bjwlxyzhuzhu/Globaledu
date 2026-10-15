import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { loadLeaflet } from '../lib/leaflet';
import { PROVINCE_EN } from '../lib/cnRegions';
import { CHINA_STDMAP, projectToStdmap } from '../lib/stdmap';
import { TIANDITU_APPROVAL, tdtLeafletUrl, usingTianditu } from '../lib/tianditu';
import { redDot } from '../lib/mapFocus';
import { centroidLat, centroidLng } from '../lib/tz';
import { api } from '../lib/api';
import type { Province } from '@shared/types';

// china.json 里南海断续线是一个没有名字的要素（adcode 100000_JD，JD = 九段）。
// 标准底图上已经画有断续线与南海诸岛，这里不再叠加，也不作为可点击热区。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isNanhai = (f: any): boolean =>
  f?.properties?.adcode === '100000_JD' || f?.properties?.adchar === 'JD';

// 中国省份地图，两种底图：
// - 天地图（默认，需 VITE_TIANDITU_KEY）：影像 + 境界 + 注记，深色调与站内星空风格一致；
//   国界、省界、南海断续线都来自天地图底图本身（审图号 GS（2026）4921号）。
// - 标准地图：自然资源部《中国地图》原图（审图号 GS(2022)4312号），原样显示、不改内容。
// 两种模式下省份都只做透明热区（悬停淡亮、点击进入），不描边，避免在标准底图上另画一套界线。
type Mode = 'tdt' | 'std';

// 南海亮窗（[lng, lat]）：从北部湾口到台湾以东、钓鱼岛，绕开海南岛与大陆海岸，避免和省份洞口重叠
const NANHAI_WINDOW: number[][] = [
  [106, 3], [125, 3], [125, 26.3], [122.2, 26.3], [122.2, 21.2], [112, 21.2], [112, 17.8], [106, 17.8],
];
const inWindow = ([x, y]: number[]): boolean => {
  let inside = false;
  for (let i = 0, j = NANHAI_WINDOW.length - 1; i < NANHAI_WINDOW.length; j = i++) {
    const [xi, yi] = NANHAI_WINDOW[i];
    const [xj, yj] = NANHAI_WINDOW[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// 世界矩形挖去各省与南海亮窗。落在亮窗里的小岛不再单独挖洞（偶奇填充下重复挖洞会反而变暗）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maskOutsideChina(L: any, geo: any): any {
  const toLL = (ring: number[][]) => ring.map((c) => [c[1], c[0]]);
  const holes: number[][][] = [toLL(NANHAI_WINDOW)];
  const add = (ring: number[][]) => {
    if (!ring.every(inWindow)) holes.push(toLL(ring));
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of geo.features as any[]) {
    const g = f?.geometry;
    if (g?.type === 'Polygon') add(g.coordinates[0]);
    else if (g?.type === 'MultiPolygon') for (const poly of g.coordinates) add(poly[0]);
  }
  const world = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
  return L.polygon([world, ...holes], { fillColor: '#05060f', fillOpacity: 0.82, stroke: false, interactive: false });
}


export default function ChinaMap() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const navRef = useRef(nav);
  navRef.current = nav;
  const elRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>(usingTianditu ? 'tdt' : 'std');

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    loadLeaflet()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(async (L: any) => {
        if (!alive || !elRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let toLatLng: ((c: number[]) => any) | undefined;
        if (mode === 'tdt') {
          map = L.map(elRef.current, { center: [34, 108], zoom: 4, minZoom: 3, maxZoom: 12, zoomSnap: 0.25, zoomControl: false, attributionControl: false });
          const sub = ['0', '1', '2', '3', '4', '5', '6', '7'];
          for (const layer of ['img', 'ibo', 'cia'] as const) {
            L.tileLayer(tdtLeafletUrl(layer), { subdomains: sub, maxZoom: 18 }).addTo(map);
          }
          // 中国全境（含南海诸岛）居中，顶部给标题/按钮、底部给审图号条留位
          const cn = L.latLngBounds([3.5, 73], [53.6, 135.1]);
          map.fitBounds(cn, { paddingTopLeft: [10, 150], paddingBottomRight: [10, 10] });
          map.setMinZoom(Math.max(2, Math.floor(map.getZoom()) - 1));
          map.setMaxBounds(cn.pad(0.6));
        } else {
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
          L.imageOverlay(CHINA_STDMAP.url, bounds, { className: 'hyxq-stdmap' }).addTo(map);
          // 顶部留出标题/城市检索按钮的高度，底部留出审图号条
          map.fitBounds(bounds, { paddingTopLeft: [20, 130], paddingBottomRight: [20, 50] });
          map.setMinZoom(map.getZoom() - 0.5);
          toLatLng = (c: number[]) => {
            const [x, y] = projectToStdmap(c[0], c[1]);
            return L.latLng(-y, x);
          };
        }
        L.control.zoom({ position: 'bottomleft' }).addTo(map);

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
        const hover = mode === 'tdt'
          ? { stroke: false, fillColor: '#f5c542', fillOpacity: 0.3 }
          : { stroke: false, fillColor: '#fff3b0', fillOpacity: 0.35 };
        L.geoJSON(hotspots, {
          ...(toLatLng ? { coordsToLatLng: toLatLng } : {}),
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

        // 天地图模式：中国以外大幅压暗，只突出中国；南海（断续线 + 南海诸岛）与钓鱼岛一带留一个亮窗，
        // 相当于标准地图的南海插图。不描边、不全黑：可见的界线始终是天地图底图自带的那一条。
        if (mode === 'tdt') maskOutsideChina(L, hotspots).addTo(map);

        // 天地图模式下保留原来的首都北京红点（标准地图原图上已有首都符号，不再叠加）
        if (mode === 'tdt') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bj = (g.features as any[]).find((f) => f?.properties?.name === '北京市');
          if (bj)
            redDot(L, centroidLat(bj.geometry), centroidLng(bj.geometry), '北京 Beijing · 首都', () =>
              navRef.current('/city/beijing'),
            ).addTo(map);
        }
      })
      .catch(() => {
        /* 加载失败不崩 */
      });
    return () => {
      alive = false;
      if (map) map.remove();
    };
  }, [mode]);

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
        className="absolute top-[118px] left-1/2 -translate-x-1/2 z-[600] glass px-4 py-1.5 rounded-full text-xs hover:border-starcyan/60 transition"
      >
        🔎 {i18n.language === 'zh' ? '城市检索' : 'City Directory'}
      </button>
      <div ref={elRef} className="absolute inset-0 z-0" style={{ background: '#0b1026' }} />
      {/* 四周压暗，让地图融进星空背景（只是叠在上面的渐变，不改底图本身） */}
      <div className="absolute inset-0 z-[400] pointer-events-none" style={{ boxShadow: 'inset 0 0 200px 60px rgba(5,6,15,0.8)' }} />
      {usingTianditu && (
        <div className="absolute top-[88px] right-3 z-[600] glass rounded-full p-0.5 flex text-xs">
          {(['tdt', 'std'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-full transition ${mode === m ? 'bg-starcyan/25 text-white' : 'text-white/70 hover:text-white'}`}
            >
              {m === 'tdt' ? (i18n.language === 'zh' ? '天地图' : 'Tianditu') : i18n.language === 'zh' ? '标准地图' : 'Standard Map'}
            </button>
          ))}
        </div>
      )}
      {/* 审图号常驻：放大平移后底图图例可能移出视野，这里固定显示 */}
      <div className="absolute bottom-3 right-3 z-[600] glass rounded-lg px-3 py-1.5 text-[11px] text-white/85 pointer-events-none">
        {mode === 'tdt'
          ? `审图号：${TIANDITU_APPROVAL} · 底图来源：天地图`
          : `审图号：${CHINA_STDMAP.approval} · ${CHINA_STDMAP.source}`}
      </div>
    </motion.div>
  );
}
