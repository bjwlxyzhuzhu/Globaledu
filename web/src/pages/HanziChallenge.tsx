import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { api } from '../lib/api';
import { loadHanziWriter } from '../lib/hanziWriter';
import { useStore } from '../store/useStore';
import type { HanziItem, HskLevel } from '@shared/types';

const LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];

// 汉字闯关（PRD §5.2）：按 HSK 等级筛字 → 字源 → 笔顺动画 → 书写测验计分 → 解锁双语文化故事 → 例词例句。
export default function HanziChallenge() {
  const { t } = useTranslation();
  const hanziProgress = useStore((s) => s.hanziProgress);
  const setHanziScore = useStore((s) => s.setHanziScore);
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);

  const [items, setItems] = useState<HanziItem[]>([]);
  const [sel, setSel] = useState<HanziItem | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [scoreMsg, setScoreMsg] = useState('');
  const [loadErr, setLoadErr] = useState(false);

  const writerEl = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writerRef = useRef<any>(null);

  useEffect(() => {
    api.hanzi().then(setItems).catch(() => setItems([]));
  }, []);

  // 只显示所选 HSK 等级的字（选不同等级 = 看到不同的字），按笔画排序
  const grid = useMemo(
    () => items.filter((it) => it.hsk === hskLevel).sort((a, b) => a.strokes - b.strokes),
    [items, hskLevel],
  );
  const doneCount = grid.filter((i) => hanziProgress[i.char]).length;
  // 切换等级时，若当前选中字不属于该等级则收起
  useEffect(() => {
    if (sel && sel.hsk !== hskLevel) setSel(null);
  }, [hskLevel, sel]);

  // 选中某字 → 创建 hanzi-writer 并自动播放笔顺
  useEffect(() => {
    if (!sel || !writerEl.current) return;
    setUnlocked(Boolean(hanziProgress[sel.char])); // 已掌握过 → 故事直接解锁
    setScoreMsg('');
    setLoadErr(false);
    let alive = true;
    writerEl.current.innerHTML = '';
    writerRef.current = null;

    loadHanziWriter()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((HW: any) => {
        if (!alive || !writerEl.current) return;
        const w = HW.create(writerEl.current, sel.char, {
          width: 230,
          height: 230,
          padding: 10,
          showCharacter: false,
          showOutline: true,
          showHintAfterMisses: 1,
          highlightOnComplete: true,
          strokeColor: '#f5c542',
          radicalColor: '#3fd2ff',
          outlineColor: 'rgba(255,255,255,0.18)',
          drawingColor: '#3fd2ff',
          drawingWidth: 26,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 240,
          onLoadCharDataError: () => alive && setLoadErr(true),
        });
        writerRef.current = w;
        w.animateCharacter();
      })
      .catch(() => alive && setLoadErr(true));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const playStroke = () => writerRef.current?.animateCharacter();

  const startQuiz = () => {
    if (!writerRef.current || !sel) return;
    setScoreMsg('');
    writerRef.current.quiz({
      showHintAfterMisses: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onComplete: (summary: any) => {
        const mistakes = summary?.totalMistakes ?? 0;
        const score = Math.max(40, 100 - mistakes * 10);
        setHanziScore(sel.char, score);
        setUnlocked(true);
        setScoreMsg(
          mistakes === 0
            ? `🎉 ${t('hanzi.perfect')} 100`
            : `${t('hanzi.score')} ${score} · ${t('hanzi.mistakes')} ${mistakes}`,
        );
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen">
      <Hud />
      <BackButton to="/modules" />

      <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-16">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-glow">🈶 {t('hanzi.title')}</h1>
          <p className="mt-2 text-white/60 text-sm">
            HSK{hskLevel} · ⭐ {t('hanzi.done')} {doneCount}/{grid.length}
          </p>
        </div>

        {/* HSK 等级选择：选不同等级 = 看到不同的字 */}
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

        {/* 字卡网格（仅该 HSK 等级的字） */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {grid.map((it) => (
            <button
              key={it.char}
              onClick={() => setSel(it)}
              className={`w-14 h-14 rounded-xl text-2xl transition relative ${
                sel?.char === it.char ? 'btn-primary' : 'glass hover:border-starcyan/60'
              }`}
              title={`${it.pinyin} · HSK${it.hsk}`}
            >
              {it.char}
              {hanziProgress[it.char] ? (
                <span className="absolute -top-1.5 -right-1.5 text-xs">⭐</span>
              ) : null}
            </button>
          ))}
          {grid.length === 0 && <p className="text-white/45 text-sm py-4">该等级暂无汉字，换个等级试试 · No characters at this level yet.</p>}
        </div>

        <AnimatePresence mode="wait">
          {sel && (
            <motion.div
              key={sel.char}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* 左：字源 + 笔顺 + 书写测验 */}
              <div className="glass rounded-3xl p-6 flex flex-col items-center">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-gold">{sel.char}</span>
                  <span className="text-xl text-starcyan">{sel.pinyin}</span>
                </div>
                <p className="text-xs text-white/55 mt-1 mb-3">
                  {t('hanzi.radical')} {sel.radical} · {t('hanzi.strokes')} {sel.strokes} · HSK{sel.hsk}
                </p>

                <div
                  ref={writerEl}
                  className="bg-space-900/60 rounded-2xl border border-white/10 grid place-items-center"
                  style={{ width: 230, height: 230 }}
                >
                  {loadErr && (
                    <span className="text-xs text-white/40 px-4 text-center">
                      笔顺数据加载失败 · stroke data unavailable
                    </span>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={playStroke}
                    className="glass px-4 py-2 rounded-xl text-sm hover:border-starcyan/60"
                  >
                    {t('hanzi.playStroke')}
                  </button>
                  <button onClick={startQuiz} className="btn-primary px-4 py-2 rounded-xl text-sm">
                    {t('hanzi.practice')}
                  </button>
                </div>
                {scoreMsg && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-3 text-gold font-semibold"
                  >
                    {scoreMsg}
                  </motion.div>
                )}
              </div>

              {/* 右：文化故事（练习后解锁）+ 例词例句（字不离词） */}
              <div className="glass rounded-3xl p-6">
                <h3 className="font-semibold text-glow mb-2">📖 {t('hanzi.story')}</h3>
                {unlocked ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-sm leading-relaxed text-white/90">{sel.story_zh}</p>
                    <p className="text-xs text-white/55 mt-2 leading-relaxed">{sel.story_native}</p>
                  </motion.div>
                ) : (
                  <p className="text-sm text-white/45">🔒 {t('hanzi.storyLocked')}</p>
                )}

                <h3 className="font-semibold text-glow mt-5 mb-2">🧩 {t('hanzi.words')}</h3>
                <div className="space-y-2">
                  {sel.words.map((w, i) => (
                    <div key={i} className="text-sm flex items-baseline gap-2 flex-wrap">
                      <span className="text-gold font-medium text-base">{w.word}</span>
                      <span className="text-starcyan text-xs">{w.pinyin}</span>
                      <span className="text-white/55 text-xs">{w.meaning_en}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
