import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import type { HskLevel } from '@shared/types';

// 随 HSK 等级变化的模块，卡片显示该等级条目数（汉字按本级、听力/阅读按≤本级、HSK按本级）
const UNIT: Record<string, string> = { hanzi: '字', listening: '篇', reading: '篇', hsk: '题' };

// 学习星球：七模块 + 文化知识闯关，均已实现。route 不填则默认 /module/<id>。
const MODULES: { id: string; icon: string; color: string; live: boolean; route?: string }[] = [
  { id: 'hanzi', icon: '🈶', color: '#f5c542', live: true },
  { id: 'listening', icon: '🎧', color: '#3fd2ff', live: true },
  { id: 'speaking', icon: '🗣️', color: '#7c9cff', live: true },
  { id: 'reading', icon: '📖', color: '#9be15d', live: true },
  { id: 'hsk', icon: '📝', color: '#ff8fab', live: true },
  { id: 'hskk', icon: '🎤', color: '#ffd56b', live: true },
  { id: 'culture', icon: '🏮', color: '#ff6b6b', live: true },
  { id: 'culturequiz', icon: '🎮', color: '#b794f6', live: true, route: '/module/culture-quiz' },
];

const HSK_LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];

export default function ModuleStage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);
  const hanziProgress = useStore((s) => s.hanziProgress);
  const hanziDone = Object.keys(hanziProgress).length;

  // 拉取分级模块数据，用于卡片上随等级实时变化的条目计数
  const [data, setData] = useState<{ hanzi: { hsk: number }[]; listening: { hsk: number }[]; reading: { hsk: number }[]; hsk: { level: number }[] }>({
    hanzi: [],
    listening: [],
    reading: [],
    hsk: [],
  });
  useEffect(() => {
    Promise.all([
      api.hanzi().catch(() => []),
      api.learn<{ hsk: number }[]>('listening').catch(() => []),
      api.learn<{ hsk: number }[]>('reading').catch(() => []),
      api.learn<{ level: number }[]>('hsk').catch(() => []),
    ]).then(([hanzi, listening, reading, hsk]) => setData({ hanzi: hanzi as { hsk: number }[], listening, reading, hsk }));
  }, []);
  const counts = useMemo<Record<string, number>>(
    () => ({
      hanzi: data.hanzi.filter((x) => x.hsk === hskLevel).length, // 汉字：本级
      listening: data.listening.filter((x) => x.hsk <= hskLevel).length, // 听力：≤本级
      reading: data.reading.filter((x) => x.hsk <= hskLevel).length, // 阅读：≤本级
      hsk: data.hsk.filter((x) => x.level === hskLevel).length, // HSK 题：本级
    }),
    [data, hskLevel],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative min-h-screen overflow-hidden"
    >
      <Hud />
      <BackButton to="/globe" label={t('common.backToGlobe')} />

      {/* 剧场光晕背景 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh]"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 0%, rgba(124,156,255,0.18), transparent 70%), radial-gradient(40% 50% at 50% 0%, rgba(245,197,66,0.12), transparent 70%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <motion.h1
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-3xl sm:text-4xl font-bold text-glow"
        >
          🎭 {t('modules.title')}
        </motion.h1>
        <p className="mt-2 text-white/65 text-sm">{t('modules.subtitle')}</p>

        {/* HSK 等级选择器（全局生效） */}
        <div className="mt-6 inline-flex items-center gap-2 glass rounded-full px-4 py-2">
          <span className="text-xs text-white/55 mr-1">{t('modules.hskLevel')}</span>
          {HSK_LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setHskLevel(lv)}
              className={`w-8 h-8 rounded-lg text-sm transition ${
                hskLevel === lv
                  ? 'btn-primary font-bold'
                  : 'glass hover:border-starcyan/60 text-white/70'
              }`}
            >
              {lv}
            </button>
          ))}
        </div>

        {/* 模块星球卡片 */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => nav(m.route ?? `/module/${m.id}`)}
              className="glass rounded-3xl p-6 text-left relative overflow-hidden group"
            >
              {/* 星球光晕 */}
              <div
                className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition"
                style={{ background: m.color }}
              />
              <div className="relative">
                <div className="text-5xl mb-3">{m.icon}</div>
                <h3 className="text-lg font-semibold" style={{ color: m.color }}>
                  {t(`mod.${m.id}`)}
                </h3>
                <p className="text-xs text-white/55 mt-1">{t(`mod.${m.id}_d`)}</p>
                {UNIT[m.id] && (
                  <div className="mt-2 inline-block text-[11px] text-starcyan/90 font-medium bg-starcyan/10 rounded-full px-2 py-0.5">
                    HSK{hskLevel} · {counts[m.id] ?? 0} {UNIT[m.id]}
                  </div>
                )}

                {m.id === 'hanzi' && hanziDone > 0 && (
                  <div className="mt-3 text-xs text-gold">
                    ⭐ {t('hanzi.done')} {hanziDone}
                  </div>
                )}
              </div>

              {/* 状态角标 */}
              {m.live ? (
                <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold tracking-wide">
                  LIVE
                </span>
              ) : (
                <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/45">
                  {t('modules.comingSoon')}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
