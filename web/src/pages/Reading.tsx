import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import { api } from '../lib/api';
import { speak, ttsSupported } from '../lib/speech';
import { useStore } from '../store/useStore';
import type { ReadingItem, HskLevel } from '@shared/types';

type Tok = ReadingItem['tokens'][number];
const LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];

// 阅读模块（PRD §5）：分级短文逐词渲染 + 生词即点即查（拼音/释义）+ TTS 朗读 + 母语对照。
export default function Reading() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);
  const [items, setItems] = useState<ReadingItem[]>([]);
  const [sel, setSel] = useState<ReadingItem | null>(null);
  const [look, setLook] = useState<Tok | null>(null);
  const [showTrans, setShowTrans] = useState(false);
  const tts = ttsSupported();

  useEffect(() => {
    api
      .learn<ReadingItem[]>('reading')
      .then((d) => setItems(d.sort((a, b) => a.hsk - b.hsk)))
      .catch(() => setItems([]));
  }, []);

  const open = (it: ReadingItem) => {
    setSel(it);
    setLook(null);
    setShowTrans(false);
  };
  const fullText = sel?.tokens.map((tk) => tk.w).join('') || '';

  // 按所选 HSK 等级筛选短文（≤ 该等级）；切换等级时若当前短文超出等级则收起
  const shown = items.filter((it) => it.hsk <= hskLevel);
  useEffect(() => {
    if (sel && sel.hsk > hskLevel) setSel(null);
  }, [hskLevel, sel]);

  return (
    <ModuleShell icon="📖" titleKey="mod.reading" subtitleKey="mod.reading_d">
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

      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {shown.map((it) => (
          <button
            key={it.id}
            onClick={() => open(it)}
            className={`px-3 py-2 rounded-xl text-sm transition ${sel?.id === it.id ? 'btn-primary' : 'glass hover:border-starcyan/60'}`}
          >
            <span className="text-[10px] text-starcyan mr-1">HSK{it.hsk}</span>
            {zh ? it.title_zh : it.title_en}
          </button>
        ))}
        {shown.length === 0 && <p className="text-white/45 text-sm">{zh ? '该等级暂无短文，调高等级试试。' : 'No passages at this level yet — try a higher level.'}</p>}
      </div>

      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gold">
                {sel.title_zh} <span className="text-white/45 text-sm font-normal">{sel.title_en}</span>
              </h3>
              <button onClick={() => speak(fullText)} disabled={!tts} className="text-xs glass px-3 py-1.5 rounded-lg hover:border-starcyan/60 disabled:opacity-40">
                🔊 {t('learn.readAloud')}
              </button>
            </div>

            {/* 逐词正文：可点词查拼音/释义 */}
            <p className="text-2xl leading-loose tracking-wide">
              {sel.tokens.map((tk, i) =>
                tk.py ? (
                  <button
                    key={i}
                    onClick={() => setLook(tk)}
                    className={`inline hover:text-gold transition border-b border-dashed ${
                      look?.w === tk.w ? 'text-gold border-gold' : 'border-white/25'
                    }`}
                  >
                    {tk.w}
                  </button>
                ) : (
                  <span key={i} className="text-white/80">
                    {tk.w}
                  </span>
                ),
              )}
            </p>
            <p className="text-[11px] text-white/40 mt-2">👆 {t('learn.tapHint')}</p>

            {/* 查词弹出 */}
            <AnimatePresence>
              {look && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 bg-space-900/60 border border-starcyan/30 rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-2xl text-gold">{look.w}</span>
                  <div>
                    <div className="text-starcyan text-sm">{look.py}</div>
                    <div className="text-white/70 text-sm">{look.en}</div>
                  </div>
                  <button onClick={() => speak(look.w)} disabled={!tts} className="ml-auto text-xs glass px-2.5 py-1 rounded-lg disabled:opacity-40">
                    🔊
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 母语对照 */}
            <div className="mt-5">
              <button onClick={() => setShowTrans((v) => !v)} className="glass px-4 py-2 rounded-xl text-sm hover:border-starcyan/60">
                {showTrans ? t('learn.hideText') : `🌐 ${t('learn.translation')}`}
              </button>
              {showTrans && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-white/75 text-sm leading-relaxed">{sel.translation_en}</motion.p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModuleShell>
  );
}
