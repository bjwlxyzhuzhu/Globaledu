import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import type { QuizQuestion, HskLevel } from '@shared/types';

const LANG_NAME: Record<string, string> = { en: 'English', fr: 'Français', es: 'Español', ru: 'Русский', ar: 'العربية', de: 'Deutsch' };
const LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];

// 中文语言导师·出题练习：按当前主题（城市/文化）+ HSK 等级，AI 现场出四选一分级题，即时判分+解析。
export default function QuizPanel({ topic, onClose }: { topic: string; onClose: () => void }) {
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);
  const model = useStore((s) => s.model);
  const uiLangs = useStore((s) => s.uiLangs);
  const setModuleScore = useStore((s) => s.setModuleScore);
  const nativeLang = LANG_NAME[uiLangs.find((l) => l !== 'zh') || 'en'] || 'English';

  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [mock, setMock] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setQs([]);
    setIdx(0);
    setPicked(null);
    setCorrect(0);
    setDone(false);
    try {
      const r = await api.quizGenerate({ topic, hskLevel, count: 5, model: model || undefined, nativeLang });
      setQs(r.questions);
      setMock(r.mock);
      setSources(r.sources || []);
    } catch {
      setQs([]);
    } finally {
      setLoading(false);
    }
  }, [topic, hskLevel, model, nativeLang]);

  useEffect(() => {
    load();
  }, [load]);

  const cur = qs[idx];
  const choose = (i: number) => {
    if (picked !== null || !cur) return;
    setPicked(i);
    if (i === cur.answer) setCorrect((c) => c + 1);
  };
  const next = () => {
    if (idx + 1 >= qs.length) {
      setModuleScore(`cityquiz:${topic}`, Math.round((correct / Math.max(1, qs.length)) * 100));
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex flex-col bg-space-900/97 backdrop-blur">
      {/* 头部 */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <span className="text-xl">📝</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-glow text-sm leading-tight">中文语言导师 · 出题练习</h3>
          <p className="text-[11px] text-white/55 truncate">
            主题：<span className="text-gold">{topic}</span> · HSK{hskLevel}
          </p>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">×</button>
      </div>

      {/* HSK 等级 + 换一组 */}
      <div className="px-5 py-2 border-b border-white/10 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-white/50 mr-1">HSK</span>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => setHskLevel(lv)}
            className={`w-7 h-7 rounded-lg text-xs transition ${hskLevel === lv ? 'btn-primary font-bold' : 'glass hover:border-starcyan/60'}`}
          >
            {lv}
          </button>
        ))}
        <button onClick={load} disabled={loading} className="ml-auto text-[11px] glass px-2.5 py-1 rounded-lg hover:border-gold/60 disabled:opacity-40">
          🔄 换一组
        </button>
      </div>

      {/* 题目区 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <p className="text-sm text-white/55 text-center mt-10">🧠 AI 正在按「{topic}」和 HSK{hskLevel} 难度出题…</p>
        ) : qs.length === 0 ? (
          <p className="text-sm text-white/45 text-center mt-10">这次没出到题，点上面「换一组」再试。</p>
        ) : done ? (
          <div className="text-center mt-6">
            <div className="text-5xl mb-2">{correct === qs.length ? '🏆' : correct >= qs.length * 0.6 ? '🎉' : '💪'}</div>
            <p className="text-2xl font-bold text-gold">{Math.round((correct / qs.length) * 100)} 分</p>
            <p className="text-sm text-white/60 mt-1">答对 {correct} / {qs.length}</p>
            <button onClick={load} className="btn-primary px-5 py-2.5 rounded-xl text-sm mt-5">🔄 再来一组</button>
          </div>
        ) : cur ? (
          <div>
            <div className="flex justify-between text-xs text-white/45 mb-2">
              <span>第 {idx + 1} / {qs.length} 题</span>
              <span className="text-starcyan">HSK{hskLevel}</span>
            </div>
            <p className="text-base mb-1 leading-relaxed">{cur.stem_zh}</p>
            <p className="text-xs text-white/45 mb-3">{cur.stem_en}</p>
            <div className="space-y-2">
              {cur.options.map((o, i) => {
                const show = picked !== null;
                const isAns = i === cur.answer;
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition ${
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                <p className={`text-sm font-semibold ${picked === cur.answer ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {picked === cur.answer ? '✅ 正确' : '❌ 再想想'}
                </p>
                <p className="text-sm text-white/65 mt-1">{cur.explain_zh}</p>
                <p className="text-xs text-white/45 mt-0.5">{cur.explain_en}</p>
                <button onClick={next} className="btn-primary px-5 py-2 rounded-xl text-sm mt-3">
                  {idx + 1 >= qs.length ? '🏁 完成' : '下一题 →'}
                </button>
              </motion.div>
            )}
          </div>
        ) : null}

        {mock && !loading && <p className="text-[10px] text-amber-300/70 mt-5 text-center">演示题 · 连真实大模型后按知识库现出题</p>}
        {sources.length > 0 && !loading && <p className="text-[10px] text-white/35 mt-5 text-center">📚 出题依据：{sources.join('、')}</p>}
      </div>
    </motion.div>
  );
}
