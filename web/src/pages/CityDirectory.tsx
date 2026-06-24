import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { api } from '../lib/api';
import { CITY_EN } from '../lib/cityEn';

interface City {
  name: string;
  province: string;
}

// 城市检索：搜索/按省份筛选全国 370 个城市，点击直达该城智能体（不必再地图下钻）。
export default function CityDirectory() {
  const { i18n } = useTranslation();
  const nav = useNavigate();
  const zh = i18n.language === 'zh';
  const [cities, setCities] = useState<City[]>([]);
  const [q, setQ] = useState('');
  const [prov, setProv] = useState('all');

  useEffect(() => {
    api.citylist().then(setCities).catch(() => setCities([]));
  }, []);

  const provinces = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cities) m[c.province] = (m[c.province] || 0) + 1;
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  }, [cities]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return cities.filter((c) => {
      if (prov !== 'all' && c.province !== prov) return false;
      if (query) {
        const hay = `${c.name} ${c.province} ${CITY_EN[c.name] || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [cities, q, prov]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen">
      <Hud />
      <BackButton to="/map/china" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[45vh]" style={{ background: 'radial-gradient(55% 70% at 50% 0%, rgba(124,156,255,0.14), transparent 70%)' }} />

      <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-glow">🔎 {zh ? '城市检索' : 'City Directory'}</h1>
          <p className="mt-2 text-white/55 text-sm">
            {zh ? `搜索全国 ${cities.length} 个城市，点开即可与当地智能体对话` : `Search ${cities.length} cities across China; tap to chat with a local agent`}
          </p>
        </div>

        {/* 搜索 + 省份 */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={zh ? '搜索城市（中文或拼音，如 西安 / Xi’an）' : 'Search city (e.g. Xi’an, Chengdu)'}
              className="w-full bg-space-800 border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white/90 focus:border-starcyan/60 outline-none"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                ×
              </button>
            )}
          </div>
          <select value={prov} onChange={(e) => setProv(e.target.value)} className="bg-space-800 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/90 focus:border-starcyan/60 outline-none sm:w-44">
            <option value="all">{zh ? '全部省份/地区' : 'All provinces'}</option>
            {provinces.map(([p, n]) => (
              <option key={p} value={p}>
                {p}（{n}）
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-white/40 mb-3 text-center">{zh ? `找到 ${shown.length} 个城市` : `${shown.length} cities`}</p>

        {/* 城市网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {shown.map((c) => (
            <button
              key={c.province + c.name}
              onClick={() => nav(`/city/place_${encodeURIComponent(c.name)}`)}
              className="glass rounded-xl px-3 py-2.5 text-left hover:border-starcyan/60 hover:-translate-y-0.5 transition group"
            >
              <div className="font-medium text-white/90 group-hover:text-starcyan transition">{c.name}</div>
              <div className="text-[11px] text-white/40 flex items-center justify-between">
                <span>{CITY_EN[c.name] || ''}</span>
                <span className="text-white/30">{c.province}</span>
              </div>
            </button>
          ))}
          {shown.length === 0 && cities.length > 0 && (
            <p className="col-span-full text-center text-white/40 text-sm py-8">{zh ? '没有匹配的城市，换个关键词试试。' : 'No matching city — try another keyword.'}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
