import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import { api } from '../lib/api';
import { speak, ttsSupported } from '../lib/speech';
import { useStore } from '../store/useStore';
import type { ListeningItem, HskLevel } from '@shared/types';

const LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];

// 听力模块（PRD §5）：按 HSK 等级筛选分级短文 + 可调速 TTS 朗读 + 听后选择题计分 + 揭示原文/拼音/译文（影子跟读）。
export default function Listening() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const setModuleScore = useStore((s) => s.setModuleScore);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);

  const [items, setItems] = useState<ListeningItem[]>([]);
  const [sel, setSel] = useState<ListeningItem | null>(null);
  const [rate, setRate] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const tts = ttsSupported();

  useEffect(() => {
    api
      .learn<ListeningItem[]>('listening')
      .then((d) => setItems(d.sort((a, b) => a.hsk - b.hsk)))
      .catch(() => setItems([]));
  }, []);

  const open = (it: ListeningItem) => {
    setSel(it);
    setPicked(null);
    setRevealed(false);
    setTimeout(() => speak(it.text_zh, { rate }), 200);
  };

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (sel) {
      const ok = i === sel.answer;
      setModuleScore(`listening:${sel.id}`, ok ? 100 : 40);
      if (ok) setRevealed(true);
    }
  };

  // 按所选 HSK 等级筛选短文（≤ 该等级）；切换等级时若当前短文超出等级则收起
  const shown = items.filter((it) => it.hsk <= hskLevel);
  useEffect(() => {
    if (sel && sel.hsk > hskLevel) setSel(null);
  }, [hskLevel, sel]);

  return (
    <ModuleShell icon="🎧" titleKey="mod.listening" subtitleKey="mod.listening_d">
      {/* HSK 等级筛选：选不同等级 = 解锁不同难度的短文 */}
      <div className="flex items-center justify-center gap-2 mb-5">
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

      {/* 短文选择（仅显示 HSK ≤ 所选等级的短文） */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {shown.map((it) => (
          <button
            key={it.id}
            onClick={() => open(it)}
            className={`px-3 py-2 rounded-xl text-sm transition relative ${
              sel?.id === it.id ? 'btn-primary' : 'glass hover:border-starcyan/60'
            }`}
          >
            <span className="text-[10px] text-starcyan mr-1">HSK{it.hsk}</span>
            {zh ? it.title_zh : it.title_en}
            {moduleProgress[`listening:${it.id}`] === 100 && <span className="absolute -top-1.5 -right-1.5 text-xs">✅</span>}
          </button>
        ))}
        {shown.length === 0 && <p className="text-white/45 text-sm">{zh ? '该等级暂无短文，调高等级试试。' : 'No passages at this level yet — try a higher level.'}</p>}
      </div>

      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-6">
            {/* 播放器 */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => speak(sel.text_zh, { rate })}
                disabled={!tts}
                className="w-20 h-20 rounded-full btn-primary text-3xl grid place-items-center disabled:opacity-40 shadow-lg"
                title={tts ? t('learn.play') : t('learn.ttsUnsupported')}
              >
                ▶
              </button>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/55 text-xs">{t('learn.speed')}</span>
                {[0.6, 0.8, 1].map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRate(r);
                      speak(sel.text_zh, { rate: r });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs ${rate === r ? 'btn-primary' : 'glass'}`}
                  >
                    {r === 1 ? '1.0×' : `${r}×`}
                  </button>
                ))}
              </div>
              {!tts && <p className="text-xs text-amber-300/80">{t('learn.ttsUnsupported')}</p>}
            </div>

            {/* 选择题 */}
            <div className="mt-6">
              <p className="font-medium text-center mb-3">{zh ? sel.question_zh : sel.question_en}</p>
              <div className="space-y-2 max-w-md mx-auto">
                {sel.options.map((o, i) => {
                  const isAns = i === sel.answer;
                  const show = picked !== null;
                  return (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border transition text-sm ${
                        show && isAns
                          ? 'border-emerald-400/70 bg-emerald-500/15'
                          : show && picked === i
                            ? 'border-red-400/60 bg-red-500/10'
                            : 'border-white/12 glass hover:border-starcyan/60'
                      }`}
                    >
                      {zh ? o.zh : `${o.zh} · ${o.en}`}
                      {show && isAns && ' ✅'}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <p className={`text-center mt-3 font-semibold ${picked === sel.answer ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {picked === sel.answer ? `✅ ${t('learn.correct')}` : `❌ ${t('learn.wrong')}`}
                </p>
              )}
            </div>

            {/* 影子跟读：揭示原文/拼音/译文 */}
            <div className="mt-6 text-center">
              <button onClick={() => setRevealed((v) => !v)} className="glass px-4 py-2 rounded-xl text-sm hover:border-starcyan/60">
                {revealed ? t('learn.hideText') : `📝 ${t('learn.reveal')}`}
              </button>
            </div>
            {revealed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 bg-space-900/50 rounded-2xl p-4 text-center">
                <p className="text-lg text-gold leading-relaxed">{sel.text_zh}</p>
                <p className="text-sm text-starcyan/90 mt-1">{sel.pinyin}</p>
                <p className="text-sm text-white/60 mt-1">{sel.translation_en}</p>
                <button
                  onClick={() => speak(sel.text_zh, { rate: 0.7 })}
                  disabled={!tts}
                  className="mt-3 text-xs glass px-3 py-1.5 rounded-lg hover:border-gold/60 disabled:opacity-40"
                >
                  🐢 {t('learn.shadow')}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ModuleShell>
  );
}
