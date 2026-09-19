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
  islands?: GeoJson | null; // 南海断续线 + 南海诸岛 + 钓鱼岛（data/geo/cn-islands.json）
  disputed?: GeoJson | null; // 国际争议地区（data/geo/cn-disputed.json）
  onSelect: (code: string, name: string, tz: string) => void;
  autoRotate?: boolean;
}

// 注记分级的相机高度阈值：高于此值只显示「南海诸岛」总注记，低于则展开四个分组。
const LABEL_TIER_ALT = 1;

const flagImg = (iso?: string) =>
  iso && iso !== '-99'
    ? `<img src="${flagUrl(iso, 'w40')}" alt="${iso}" style="width:34px;height:auto;border-radius:3px;box-shadow:0 1px 5px rgba(0,0,0,.5)"/>`
    : '';

// 台湾属于中国：地球上与中国同为金色高亮、联动凸起，此级不单独标注（省份级再出现）。
const isChina = (code: string) => code === 'CN' || code === 'TW';

// globe.gl 封装：明亮蓝色弹珠（地形地貌）地球 + 各国板块（悬停凸起+边线高亮+国旗中英名+时区）。
export default function GlobeCanvas({ countries, geo, islands, disputed, onSelect, autoRotate = true }: Props) {
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
      if (f?.properties?.kind === 'disputed') return hi ? 'rgba(168,172,186,0.42)' : 'rgba(150,155,170,0.30)';
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
      // 争议控制线：浅灰细线。真正的虚线由下面 pathsData 那条通道画。
      if (f?.properties?.kind === 'disputed') return 'rgba(210,214,226,0.55)';
      if (hi) return '#fff7d6';
      if (isChina(iso(f))) return 'rgba(245,197,66,0.7)';
      return byIso.get(iso(f)) ? 'rgba(150,200,255,0.75)' : 'rgba(170,190,240,0.4)';
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = (f: any) => {
      if (f?.properties?.kind === 'disputed') {
        // 规范：地图 UI 弹窗只放地名，不做单方面归属定性
        return `<div style="background:rgba(8,12,30,.93);border:1px solid rgba(190,196,214,.5);padding:6px 10px;border-radius:10px;color:#e6eaf5;font-size:12px;font-family:'Noto Sans SC',system-ui,sans-serif">
          <div style="font-weight:700">${f.properties.zh}</div>
          <div style="font-size:11px;opacity:.75">${f.properties.en}</div>
        </div>`;
      }
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
    const base = (((geo as any)?.features as any[]) || []) as any[];
    // 南海诸岛与钓鱼岛并入板块图层：它们带 ISO_A2:'CN'，因此自动与中国同为金色、
    // 点击同样进省份地图。注意没有并进 world.json 的中国板块本身——前端的
    // centroidLng/Lat 取顶点平均，700 多个小岛的顶点会把中国质心从华中拖到南海，
    // 影响相机飞行与标注定位。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const islandPolys = ((((islands as any)?.features as any[]) || []) as any[]).filter(
      (f) => f?.geometry?.type === 'Polygon',
    );
    // 争议地区：已从各国板块中扣除，这里单独补回来渲染。
    // 李老师要求「争议不用很明显出来」，因此用低饱和中性色、不发光、不参与悬停凸起。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disputedPolys = ((((disputed as any)?.features as any[]) || []) as any[]).filter(
      (f) => f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon',
    );
    const features = [...base, ...islandPolys, ...disputedPolys];
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
        if (f?.properties?.kind === 'disputed') return; // 争议地区不做归属，不导航
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
  }, [geo, countries, islands, disputed]);

  // 断续线与岛名注记：两条独立通道，不走板块图层。
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !islands) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dFeats = (((disputed as any)?.features as any[]) || []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feats = (((islands as any).features as any[]) || []) as any[];

    // 断续线：pathsData。金色、线宽 2.5，不参与悬停凸起与点击。
    const dashes = feats
      .filter((f) => f?.geometry?.type === 'LineString')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f) => (f.geometry.coordinates as number[][]).map((c) => [c[1], c[0]]));
    // 争议控制线：取争议区外环画成虚线（规范：争议控制线/停火线用虚线，主权国界用实线）
    const ringsOf = (f: any): number[][][] =>
      f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map((p: any) => p[0]) : [f.geometry.coordinates[0]];
    const disputedLines = dFeats
      .filter((f) => f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon')
      .flatMap((f) => ringsOf(f))
      .map((ring) => ({ pts: ring.map((c) => [c[1], c[0]]), dashed: true }));
    const solidDashes = dashes.map((d: any) => ({ pts: d, dashed: false }));

    g.pathsData([...solidDashes, ...disputedLines])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .pathPoints((d: any) => d.pts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .pathPointLat((p: any) => p[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .pathPointLng((p: any) => p[1])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .pathColor((d: any) => (d.dashed ? 'rgba(214,218,230,0.7)' : 'rgba(245,197,66,0.95)'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .pathStroke((d: any) => (d.dashed ? 1.1 : 2.5))
      // 虚线：争议控制线；断续线本身是十段独立线，保持实线
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .pathDashLength((d: any) => (d.dashed ? 0.035 : 1))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .pathDashGap((d: any) => (d.dashed ? 0.022 : 0))
      .pathDashAnimateTime(0)
      .pathTransitionDuration(0);

    // 岛名注记：用 HTML 而不是 labelsData —— three 的 3D 文字字体不含中文字形，
    // 「南沙群岛」会渲染成四个方块。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const labels = [
      ...((((islands as any).labels as any[]) || []) as any[]),
      ...((((disputed as any)?.labels as any[]) || []) as any[]),
    ];
    const forAlt = (alt: number) =>
      labels.filter((l) => l.scope === 'both' || (alt > LABEL_TIER_ALT ? l.scope === 'far' : l.scope === 'near'));

    g.htmlElementsData(forAlt(2.2))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .htmlLat((d: any) => d.lat)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .htmlLng((d: any) => d.lng)
      .htmlAltitude(0.01)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .htmlElement((d: any) => {
        const el = document.createElement('div');
        el.style.cssText =
          'pointer-events:none;white-space:nowrap;text-align:center;font-family:"Noto Sans SC",system-ui,sans-serif;' +
          'color:#f5c542;text-shadow:0 0 6px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,1);transform:translate(-50%,-50%)';
        el.innerHTML =
          `<div style="font-size:12px;font-weight:700;line-height:1.15">${d.zh}</div>` +
          `<div style="font-size:9px;opacity:.85;line-height:1.15">${d.en}</div>`;
        return el;
      });

    // 缩放时切换注记分级（整球视角下西沙与中沙实际质心只差约 4° 经度，必然压盖）
    let tier = 2.2 > LABEL_TIER_ALT;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g.onZoom((pov: any) => {
      const next = (pov?.altitude ?? 2.2) > LABEL_TIER_ALT;
      if (next !== tier) {
        tier = next;
        g.htmlElementsData(forAlt(pov.altitude));
      }
    });
  }, [islands, disputed]);

  return <div ref={ref} className="w-full h-full" />;
}
