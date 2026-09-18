import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { api } from '../lib/api';

type Metrics = {
  count: number;
  vocab_in_level_rate: number;
  sycophancy_rate: number;
  taboo_rate: number;
  avg_sentence_len: number;
  recent: Record<string, unknown>[];
};

const MODULES = ['hanzi', 'listening', 'speaking', 'reading', 'hsk', 'hskk', 'culture'];
const MOD_LABEL: Record<string, string> = { hanzi: '汉字', listening: '听力', speaking: '口语', reading: '阅读', hsk: 'HSK', hskk: 'HSKK', culture: '文化' };

function lsGet(k: string, d: string): string {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
}

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const [m, setM] = useState<Metrics | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(lsGet('hyxq_teacher_modules', '{}')) as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [manifest, setManifest] = useState<string>('');

  useEffect(() => {
    api.metrics().then(setM).catch(() => setM(null));
  }, []);

  const toggle = (mod: string) => {
    const next = { ...enabled, [mod]: enabled[mod] === false ? true : !enabled[mod] };
    // 默认开启：未设过视为 true，点一下变 false
    next[mod] = !(enabled[mod] ?? true);
    setEnabled(next);
    try {
      localStorage.setItem('hyxq_teacher_modules', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const card = (label: string, val: string | number, color: string) => (
    <div className="bg-space-900/50 rounded-2xl py-4 text-center">
      <div className="text-2xl font-bold" style={{ color }}>{val}</div>
      <div className="text-xs text-white/55 mt-0.5">{label}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen">
      <Hud />
      <BackButton to="/profile" />
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-3xl font-bold text-glow">🧑‍🏫 {t('teacher.title')}</h1>
        <p className="mt-2 text-white/60 text-sm">{t('teacher.subtitle')}</p>

        {/* 学情指标 */}
        <h2 className="mt-7 mb-3 font-semibold text-glow">📊 {t('teacher.metrics')}</h2>
        {!m || m.count === 0 ? (
          <div className="glass rounded-2xl px-6 py-8 text-center text-white/55 text-sm">{t('teacher.noData')}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {card(t('teacher.totalChats'), m.count, '#3fd2ff')}
              {card(t('teacher.inLevelRate'), `${m.vocab_in_level_rate}%`, '#7ed957')}
              {card(t('teacher.sycoRate'), `${m.sycophancy_rate}%`, '#ff8fab')}
              {card(t('teacher.avgLen'), m.avg_sentence_len, '#f5c542')}
            </div>
            <h3 className="mt-5 mb-2 text-sm text-white/60">{t('teacher.recent')}</h3>
            <div className="glass rounded-2xl divide-y divide-white/8 max-h-56 overflow-y-auto text-xs">
              {m.recent.map((r, i) => (
                <div key={i} className="px-4 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-white/40">{new Date(Number(r.ts)).toLocaleTimeString()}</span>
                  <span className="text-starcyan">HSK{String(r.hsk ?? '-')}</span>
                  <span className="text-white/55">{String(r.country || 'CN')}</span>
                  <span className={r.vocab_in_level ? 'text-emerald-300' : 'text-amber-300'}>{r.vocab_in_level ? '未超纲' : '超纲'}</span>
                  <span className="text-white/40">句长 {String(r.max_sentence_len ?? '-')}</span>
                  {Number(r.rag) > 0 && <span className="text-starviolet">📚RAG</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 模块选配 */}
        <h2 className="mt-8 mb-1 font-semibold text-glow">🎛 {t('teacher.modules')}</h2>
        <p className="text-[11px] text-white/40 mb-3">{t('teacher.modulesNote')}</p>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((mod) => {
            const on = enabled[mod] ?? true;
            return (
              <button
                key={mod}
                onClick={() => toggle(mod)}
                className={`px-3.5 py-2 rounded-xl text-sm transition ${on ? 'btn-primary' : 'glass opacity-60'}`}
              >
                {on ? '☑' : '☐'} {MOD_LABEL[mod]}
              </button>
            );
          })}
        </div>

        {/* 超星泛雅对接 */}
        <h2 className="mt-8 mb-1 font-semibold text-glow">🔗 {t('teacher.chaoxing')}</h2>
        <p className="text-[11px] text-white/40 mb-3">{t('teacher.chaoxingNote')}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => api.manifest().then((d) => setManifest(JSON.stringify(d, null, 2))).catch(() => {})} className="glass px-4 py-2 rounded-xl text-sm hover:border-starcyan/60">
            📋 {t('teacher.viewManifest')}
          </button>
          <span className="text-[11px] px-2 py-1 rounded-full glass text-white/55">SSO 桩</span>
          <span className="text-[11px] px-2 py-1 rounded-full glass text-white/55">成绩回写 桩</span>
          <span className="text-[11px] px-2 py-1 rounded-full glass text-white/55">LTI 1.3 桩</span>
        </div>
        {manifest && (
          <pre className="mt-3 glass rounded-2xl p-4 text-[11px] text-white/70 overflow-x-auto whitespace-pre-wrap">{manifest}</pre>
        )}
      </div>
    </motion.div>
  );
}
