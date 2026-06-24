import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import type { HskQuizItem, HskLevel } from '@shared/types';

const LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];

// HSK 模块（PRD §5）：按所选等级自适应抽题 + 模考 + 即时判分/解析 + 错题复盘。
export default function HskQuiz() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);
  const setModuleScore = useStore((s) => s.setModuleScore);

  const [bank, setBank] = useState<HskQuizItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<HskQuizItem[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.learn<HskQuizItem[]>('hsk').then(setBank).catch(() => setBank([]));
  }, []);

  // 按所选 HSK 等级抽该等级的题（选不同等级 = 看到不同难度的题）
  const quiz = useMemo(() => bank.filter((q) => q.level === hskLevel), [bank, hskLevel]);

  // 换等级或加载题库时重置模考
  useEffect(() => {
    setIdx(0);
    setPicked(null);
    setCorrect(0);
    setWrong([]);
    setDone(false);
  }, [hskLevel, bank]);

  const cur = quiz[idx];
  const choose = (i: number) => {
    if (picked !== null || !cur) return;
    setPicked(i);
    if (i === cur.answer) setCorrect((c) => c + 1);
    else setWrong((w) => [...w, cur]);
  };
  const next = () => {
    if (idx + 1 >= quiz.length) {
      setModuleScore('hsk:exam', Math.round((correct / Math.max(1, quiz.length)) * 100));
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
    }
  };
  const restart = () => {
    setIdx(0);
    setPicked(null);
    setCorrect(0);
    setWrong([]);
    setDone(false);
  };

  return (
    <ModuleShell icon="📝" titleKey="mod.hsk" subtitleKey="mod.hsk_d">
      {/* 自适应等级 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-xs text-white/55 mr-1">{t('modules.hskLevel')}</span>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => setHskLevel(lv)}
            className={`w-8 h-8 rounded-lg text-sm transition ${hskLevel === lv ? 'btn-primary font-bold' : 'glass hover:border-starcyan/60'}`}
          >
            {lv}
          </button>
        ))}
      </div>

      {quiz.length === 0 ? (
        <p className="text-white/45 text-sm text-center">{t('learn.empty')}</p>
      ) : done ? (
        // 结果 + 错题复盘
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6 text-center">
          <div className="text-5xl mb-2">{correct === quiz.length ? '🏆' : correct >= quiz.length * 0.6 ? '🎉' : '💪'}</div>
          <p className="text-2xl font-bold text-gold">
            {t('learn.score')} {Math.round((correct / quiz.length) * 100)}
          </p>
          <p className="text-sm text-white/60 mt-1">
            {t('learn.correct')} {correct} / {quiz.length}
          </p>

          {wrong.length > 0 && (
            <div className="mt-5 text-left">
              <h4 className="font-semibold text-glow mb-2">📕 {t('learn.review')}</h4>
              <div className="space-y-2">
                {wrong.map((q) => (
                  <div key={q.id} className="bg-space-900/50 rounded-xl px-4 py-2.5 text-sm">
                    <p className="text-white/85">{zh ? q.stem_zh : q.stem_en}</p>
                    <p className="text-emerald-300 mt-1">
                      ✓ {q.options[q.answer]} <span className="text-white/50">— {zh ? q.explain_zh : q.explain_en}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={restart} className="btn-primary px-5 py-2.5 rounded-xl text-sm mt-6">
            🔄 {t('learn.restart')}
          </button>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass rounded-3xl p-6">
            <div className="flex justify-between text-xs text-white/45 mb-3">
              <span>
                {t('learn.question')} {idx + 1} / {quiz.length}
              </span>
              <span className="text-starcyan">HSK{cur.level}</span>
            </div>
            <p className="text-xl text-center mb-1">{cur.stem_zh}</p>
            {!zh && <p className="text-sm text-white/50 text-center mb-4">{cur.stem_en}</p>}

            <div className="space-y-2 max-w-md mx-auto mt-4">
              {cur.options.map((o, i) => {
                const show = picked !== null;
                const isAns = i === cur.answer;
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition ${
                      show && isAns
                        ? 'border-emerald-400/70 bg-emerald-500/15'
                        : show && picked === i
                          ? 'border-red-400/60 bg-red-500/10'
                          : 'border-white/12 glass hover:border-starcyan/60'
                    }`}
                  >
                    {o}
                    {show && isAns && ' ✅'}
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center">
                <p className={`font-semibold ${picked === cur.answer ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {picked === cur.answer ? `✅ ${t('learn.correct')}` : `❌ ${t('learn.wrong')}`}
                </p>
                <p className="text-sm text-white/60 mt-1">{zh ? cur.explain_zh : cur.explain_en}</p>
                <button onClick={next} className="btn-primary px-5 py-2 rounded-xl text-sm mt-3">
                  {idx + 1 >= quiz.length ? `🏁 ${t('learn.finish')}` : `${t('learn.next')} →`}
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </ModuleShell>
  );
}
