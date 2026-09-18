import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import { api } from '../lib/api';
import { speak, ttsSupported, asrSupported, startListening, type Recognizer } from '../lib/speech';
import { useStore } from '../store/useStore';
import type { HskkItem } from '@shared/types';

const BAND_KEY: Record<string, string> = { beginner: 'learn.bandBeginner', intermediate: 'learn.bandInter', advanced: 'learn.bandAdv' };
const BAND_COLOR: Record<string, string> = { beginner: '#9be15d', intermediate: '#3fd2ff', advanced: '#ff8fab' };

interface Dims {
  pron: number;
  flu: number;
  con: number;
  total: number;
}

// HSKK 模块（PRD §5）：初/中/高口语命题→ASR 录音→语音/流利/内容三维打分（启发式）+ 参考范例。打字兜底。
export default function Hskk() {
  const { t } = useTranslation();
  const setModuleScore = useStore((s) => s.setModuleScore);

  const [items, setItems] = useState<HskkItem[]>([]);
  const [sel, setSel] = useState<HskkItem | null>(null);
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState('');
  const [dims, setDims] = useState<Dims | null>(null);
  const [typed, setTyped] = useState('');
  const [showSample, setShowSample] = useState(false);
  const recRef = useRef<Recognizer | null>(null);
  const asr = asrSupported();
  const tts = ttsSupported();

  useEffect(() => {
    api.learn<HskkItem[]>('hskk').then(setItems).catch(() => setItems([]));
  }, []);

  const open = (it: HskkItem) => {
    setSel(it);
    setHeard('');
    setDims(null);
    setTyped('');
    setShowSample(false);
  };

  // 三维启发式打分：语音(识别成功+长度) / 流利(相对范例长度) / 内容(范例字覆盖)
  const finish = (txt: string) => {
    if (!sel || !txt.trim()) return;
    const clean = (s: string) => s.replace(/[\s，。、！？,.!?；;：:""'']/g, '');
    const said = clean(txt);
    const sample = clean(sel.sample_zh);
    const len = said.length;
    const distinct = [...new Set(sample)];
    const hit = distinct.filter((c) => said.includes(c)).length;
    const con = Math.round((hit / Math.max(1, distinct.length)) * 100);
    const flu = Math.max(40, Math.min(100, Math.round((len / Math.max(8, sample.length)) * 100)));
    const pron = Math.min(100, 70 + Math.min(30, Math.floor(len / 4)));
    const total = Math.round((pron + flu + con) / 3);
    setHeard(txt);
    setDims({ pron, flu, con, total });
    setModuleScore(`hskk:${sel.id}`, total);
    setShowSample(true);
  };

  const startRec = () => {
    if (!sel) return;
    setHeard('');
    setDims(null);
    const r = startListening({
      onResult: (txt, isFinal) => {
        setHeard(txt);
        if (isFinal) finish(txt);
      },
      onError: () => setRecording(false),
      onEnd: () => setRecording(false),
    });
    if (r) {
      recRef.current = r;
      setRecording(true);
    }
  };
  const stopRec = () => recRef.current?.stop();

  const Bar = ({ label, v }: { label: string; v: number }) => (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60">{label}</span>
        <span className="text-white/85">{v}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#3fd2ff,#f5c542)' }} />
      </div>
    </div>
  );

  return (
    <ModuleShell icon="🎤" titleKey="mod.hskk" subtitleKey="mod.hskk_d" wide>
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => open(it)}
            className={`px-4 py-2 rounded-xl text-sm transition ${sel?.id === it.id ? 'btn-primary' : 'glass hover:border-starcyan/60'}`}
          >
            <span className="text-[10px] mr-1" style={{ color: BAND_COLOR[it.band] }}>
              {t(BAND_KEY[it.band])}
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="text-white/45 text-sm">{t('learn.empty')}</p>}
      </div>

      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-6">
            <div className="text-center">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${BAND_COLOR[sel.band]}22`, color: BAND_COLOR[sel.band] }}>
                {t(BAND_KEY[sel.band])}
              </span>
              <p className="text-lg mt-3 leading-relaxed">{sel.prompt_zh}</p>
              <p className="text-sm text-white/55 mt-1">{sel.prompt_en}</p>
              <button onClick={() => speak(sel.prompt_zh)} disabled={!tts} className="mt-3 text-xs glass px-3 py-1.5 rounded-lg hover:border-starcyan/60 disabled:opacity-40">
                🔊 {t('learn.play')}
              </button>
            </div>

            {/* 录音 / 打字兜底 */}
            <div className="mt-5 flex flex-col items-center gap-3">
              {asr ? (
                <button onClick={recording ? stopRec : startRec} className={`px-5 py-2.5 rounded-xl text-sm font-medium ${recording ? 'bg-red-500/80 animate-pulse' : 'btn-primary'}`}>
                  {recording ? `⏹ ${t('learn.stop')}` : `🎙 ${t('learn.record')}`}
                </button>
              ) : (
                <p className="text-xs text-amber-300/80">{t('learn.micUnsupported')}</p>
              )}
              <div className="flex items-center gap-2 w-full max-w-md">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && finish(typed)}
                  placeholder={t('learn.typeInstead')}
                  className="flex-1 rounded-xl bg-space-900/70 border border-white/15 px-3 py-2 text-sm outline-none focus:border-starcyan/60"
                />
                <button onClick={() => finish(typed)} disabled={!typed.trim()} className="btn-primary px-3 py-2 rounded-xl text-sm disabled:opacity-40">
                  {t('learn.check')}
                </button>
              </div>
              {heard && (
                <p className="text-sm text-white/70 text-center">
                  {t('learn.yourAnswer')}：<span className="text-white">{heard}</span>
                </p>
              )}
            </div>

            {/* 三维打分 */}
            {dims && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 max-w-md mx-auto space-y-3">
                <Bar label={t('learn.dimPron')} v={dims.pron} />
                <Bar label={t('learn.dimFlu')} v={dims.flu} />
                <Bar label={t('learn.dimCon')} v={dims.con} />
                <p className="text-center text-2xl font-bold text-gold pt-1">
                  {t('learn.total')} {dims.total}
                </p>
              </motion.div>
            )}

            {/* 参考范例 */}
            {showSample && (
              <div className="mt-5 bg-space-900/50 rounded-2xl p-4">
                <p className="text-[11px] text-white/45 mb-1">💡 {t('learn.sample')}</p>
                <p className="text-sm text-white/85 leading-relaxed">{sel.sample_zh}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ModuleShell>
  );
}
