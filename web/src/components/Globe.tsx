import { useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import type { Country } from '@shared/types';
import type { GeoJson } from '../lib/api';
import { tzLabel, centroidLng } from '../lib/tz';
import { regionColorRgba } from '../lib/regionColor';
import { flagUrl } from '../lib/flag';
// 地球贴图改为本地自托管：校园网/WebVPN 下 cdn.jsdelivr.net 不可达，
// 贴图加载失败又不会抛错，结果是地球渲染成无纹理球体、在星空背景上完全看不见。
// 走 Vite import 让它们打进 /assets/（该路径已验证能被 WebVPN 正确改写）。
import earthTexture from '../assets/earth-blue-marble.jpg';
import earthBump from '../assets/earth-topology.png';

interface Props {
  countries: Country[]; // 我们有内容/元数据的国家（含中文名）
  geo: GeoJson | null; // 世界各国 GeoJSON（板块）
  onSelect: (code: string, name: string, tz: string) => void;
  autoRotate?: boolean;
}

const flagImg = (iso?: string) =>
  iso && iso !== '-99'
    ? `<img src="${flagUrl(iso, 'w40')}" alt="${iso}" style="width:34px;height:auto;border-radius:3px;box-shadow:0 1px 5px rgba(0,0,0,.5)"/>`
    : '';

// 台湾属于中国：地球上与中国同为金色高亮、联动凸起，此级不单独标注（省份级再出现）。
const isChina = (code: string) => code === 'CN' || code === 'TW';

// globe.gl 封装：明亮蓝色弹珠（地形地貌）地球 + 各国板块（悬停凸起+边线高亮+国旗中英名+时区）。
export default function GlobeCanvas({ countries, geo, onSelect, autoRotate = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const byIsoRef = useRef<Map<string, Country>>(new Map());

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = new (Globe as any)(el, { rendererConfig: { antialias: true, alpha: true } })
      .backgroundColor('rgba(0,0,0,0)') // 透明 → 露出后面的宇宙背景
      .globeImageUrl(earthTexture)
      .bumpImageUrl(earthBump)
      .showAtmosphere(true)
      .atmosphereColor('#86c8ff')
      .atmosphereAltitude(0.22)
      .polygonsTransitionDuration(300);

    const resize = () => {
      g.width(el.clientWidth);
      g.height(el.clientHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    try {
      const c = g.controls();
      c.autoRotate = autoRotate;
      c.autoRotateSpeed = 0.5;
      c.enableZoom = true;
      g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      g.pointOfView({ lat: 30, lng: 105, altitude: 2.2 }, 0);
    } catch {
      /* 控件初始化异常不致命 */
    }

    globeRef.current = g;
    return () => {
      window.removeEventListener('resize', resize);
      try {
        g._destructor?.();
      } catch {
        /* ignore */
      }
      el.innerHTML = '';
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const byIso = new Map(countries.map((c) => [c.code, c]));
    byIsoRef.current = byIso;
    const tzCache = new WeakMap<object, string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iso = (f: any): string => (f?.properties?.ISO_A2 as string) || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const featTz = (f: any): string => {
      let v = tzCache.get(f);
      if (v === undefined) {
        v = tzLabel(iso(f), centroidLng(f.geometry));
        tzCache.set(f, v);
      }
      return v;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseAlt = (f: any) => (isChina(iso(f)) || byIso.get(iso(f))?.hasContent ? 0.02 : 0.012);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capColor = (f: any, hi: boolean) => {
      const code = iso(f);
      const c = byIso.get(code);
      if (isChina(code)) return hi ? 'rgba(245,197,66,0.95)' : 'rgba(245,197,66,0.72)';
      // 每个国家按名称分配鲜明颜色（与地图省/市一致）；内容国略强
      const nm = (f?.properties?.NAME as string) || code;
      if (c?.hasContent) return regionColorRgba(nm, hi ? 0.88 : 0.66);
      return regionColorRgba(nm, hi ? 0.72 : 0.44);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strokeColor = (f: any, hi: boolean) => {
      if (hi) return '#fff7d6';
      if (isChina(iso(f))) return 'rgba(245,197,66,0.7)';
      return byIso.get(iso(f)) ? 'rgba(150,200,255,0.75)' : 'rgba(170,190,240,0.4)';
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = (f: any) => {
      const code = iso(f);
      const c = byIso.get(code);
      // 台湾此级并入中国，不单独标注「台湾」
      const zh = isChina(code) ? '中国' : c?.name_zh;
      const en = isChina(code) ? 'China' : c?.name_en || f?.properties?.NAME || '';
      const tz = featTz(f);
      return `<div style="display:flex;align-items:center;gap:10px;background:rgba(8,12,30,.93);border:1px solid rgba(127,201,255,.55);padding:8px 12px;border-radius:12px;color:#eaf2ff;box-shadow:0 6px 22px rgba(0,0,0,.5);font-family:'Noto Sans SC',system-ui,sans-serif">
        ${flagImg(isChina(code) ? 'CN' : code)}
        <div style="line-height:1.3">
          ${zh ? `<div style="font-weight:700;font-size:15px;color:${isChina(code) ? '#f5c542' : '#bfe6ff'}">${zh}</div>` : ''}
          <div style="font-size:12px;opacity:.85">${en}</div>
          ${tz ? `<div style="font-size:11px;color:#9fd0ff;margin-top:2px">🕒 ${tz}</div>` : ''}
        </div>
      </div>`;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features = (((geo as any)?.features as any[]) || []) as any[];
    g.polygonsData(features)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .polygonCapColor((f: any) => capColor(f, false))
      .polygonSideColor(() => 'rgba(99,80,200,0.22)')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .polygonStrokeColor((f: any) => strokeColor(f, false))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .polygonAltitude((f: any) => baseAlt(f))
      .polygonLabel(label)
      // 悬停：板块凸起 + 边线高亮；中国与台湾联动一起凸起
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .onPolygonHover((h: any) => {
        const hCN = h && isChina(iso(h));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lift = (f: any) => (hCN && isChina(iso(f))) || f === h;
        g.polygonAltitude((f: any) => (lift(f) ? 0.07 : baseAlt(f)))
          .polygonCapColor((f: any) => capColor(f, lift(f)))
          .polygonStrokeColor((f: any) => strokeColor(f, lift(f)));
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .onPolygonClick((f: any) => {
        const code = iso(f);
        if (!code || code === '-99') return;
        const c = byIsoRef.current.get(code);
        onSelectRef.current(code, c?.name_en || f?.properties?.NAME || code, featTz(f));
      });

    const content = countries.filter((c) => c.hasContent);
    g.ringsData(content)
      .ringLat((d: Country) => d.lat)
      .ringLng((d: Country) => d.lng)
      .ringMaxRadius((d: Country) => (d.code === 'CN' ? 5 : 3))
      .ringPropagationSpeed(2)
      .ringRepeatPeriod((d: Country) => (d.code === 'CN' ? 1100 : 1600))
      .ringColor((d: Country) => (t: number) =>
        d.code === 'CN' ? `rgba(245,197,66,${1 - t})` : `rgba(63,210,255,${1 - t})`,
      );
  }, [geo, countries]);

  return <div ref={ref} className="w-full h-full" />;
}
