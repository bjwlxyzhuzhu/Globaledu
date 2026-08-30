import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import GlobeCanvas from '../components/Globe';
import SpaceBackdrop from '../components/SpaceBackdrop';
import CountrySelect from '../components/CountrySelect';
import Hud from '../components/Hud';
import GuidedTour, { type TourStep } from '../components/GuidedTour';

// 地球页功能导览
const GLOBE_TOUR: TourStep[] = [
  { sel: '[data-tour="globe"]', title: { zh: '🌍 旋转地球', en: 'Spin the globe' }, desc: { zh: '拖动旋转地球，点击发光的国家即可进入，开启你的中文与中华文化探索之旅。点中国会进入省份地图。', en: 'Drag to spin, click a glowing country to enter. Click China to open the province map.' } },
  { sel: '[data-tour="country"]', title: { zh: '🔎 快速选国家', en: 'Pick a country' }, desc: { zh: '在地球上找不到你的国家？用这个下拉直接搜索选择，按大洲分组、带国旗与时区。', en: 'Cannot find your country on the globe? Use this dropdown to search and select, grouped by continent.' } },
  { sel: '[data-tour="modules"]', title: { zh: '📚 学习模块', en: 'Learning modules' }, desc: { zh: '听、说、读、写、HSK、文化、汉字、闯关——八大学习模块全都在这里，点击进入。', en: 'Listening, speaking, reading, writing, HSK, culture, Hanzi and quizzes — all eight modules are here.' } },
];
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
        <div className="absolute inset-0 z-10" data-tour="globe">
          <GlobeCanvas countries={countries} geo={worldGeo} onSelect={handleSelect} />
        </div>
      </div>

      {/* 右上：小国下拉选择器 */}
      <div className="fixed top-16 right-5 z-30" data-tour="country">
        <CountrySelect geo={worldGeo} onSelect={handleSelect} />
      </div>

      {/* 学习模块入口（主页显眼，听说读写/HSK/文化/闯关都在这里） */}
      <div className="absolute bottom-20 inset-x-0 flex justify-center z-20 px-4">
        <button
          data-tour="modules"
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

      <GuidedTour id="globe" steps={GLOBE_TOUR} />

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
