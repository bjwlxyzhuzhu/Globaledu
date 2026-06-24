import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import GlobeCanvas from '../components/Globe';
import SpaceBackdrop from '../components/SpaceBackdrop';
import CountrySelect from '../components/CountrySelect';
import Hud from '../components/Hud';
import { api, type GeoJson } from '../lib/api';
import type { Country } from '@shared/types';

export default function GlobeView() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const nav = useNavigate();
  const [countries, setCountries] = useState<Country[]>([]);
  const [worldGeo, setWorldGeo] = useState<GeoJson | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .countries()
      .then((cs) => alive && setCountries(cs))
      .catch(() => alive && setErr(true));
    api
      .geo('world')
      .then((g) => alive && setWorldGeo(g))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 中国/台湾 → 中国省份地图；其它国家 → 国家文化页（带英文名 + 时区）
  const handleSelect = useCallback(
    (code: string, name: string, tz: string) => {
      if (code === 'CN' || code === 'TW') {
        nav('/map/china');
      } else {
        const q = new URLSearchParams({ en: name });
        if (tz) q.set('tz', tz);
        nav(`/city/country_${code}?${q.toString()}`);
      }
    },
    [nav],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="relative w-full h-screen overflow-hidden"
    >
      <Hud />

      {/* 宇宙背景（星空/流星/月球/太阳）+ 地球仪 */}
      <div className="absolute inset-0">
        <SpaceBackdrop className="absolute inset-0 w-full h-full z-0" />
        <div className="absolute inset-0 z-10">
          <GlobeCanvas countries={countries} geo={worldGeo} onSelect={handleSelect} />
        </div>
      </div>

      {/* 右上：小国下拉选择器 */}
      <div className="fixed top-16 right-5 z-30">
        <CountrySelect geo={worldGeo} onSelect={handleSelect} />
      </div>

      {/* 学习模块入口（主页显眼，听说读写/HSK/文化/闯关都在这里） */}
      <div className="absolute bottom-20 inset-x-0 flex justify-center z-20 px-4">
        <button
          onClick={() => nav('/modules')}
          className="btn-primary rounded-full px-6 py-3 text-sm font-semibold shadow-xl hover:opacity-90 hover:-translate-y-0.5 transition flex items-center gap-2"
        >
          📚 {zh ? '学习模块' : 'Learning Modules'}
          <span className="text-[11px] font-normal opacity-80">{zh ? '听·说·读·写·HSK·文化' : 'Listen · Speak · Read · Write · HSK'}</span>
        </button>
      </div>

      {/* 底部提示 */}
      <div className="absolute bottom-8 inset-x-0 flex justify-center pointer-events-none px-4 z-20">
        <div className="glass rounded-full px-5 py-2 text-sm text-white/80">{t('globe.hint')}</div>
      </div>

      {/* 加载失败兜底 */}
      {err && (
        <div className="absolute inset-0 grid place-items-center bg-space-900/40 z-20">
          <div className="glass rounded-2xl px-6 py-5 text-center">
            <p className="mb-3 text-sm">{t('globe.loadFail')}</p>
            <button onClick={() => location.reload()} className="btn-primary px-4 py-2 rounded-lg text-sm">
              ↻
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
