import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import GradedChat from '../components/GradedChat';
import { api } from '../lib/api';
import { speak, ttsSupported, asrSupported, startListening, scoreSpeech, type Recognizer } from '../lib/speech';
import { useStore } from '../store/useStore';
import type { SpeakingItem } from '@shared/types';

// 口语模块（PRD §5）：跟读目标句→ASR 识别→匹配打分（发音诊断）；情境对话→GradedChat 角色扮演。无麦克风时打字兜底。
export default function Speaking() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const setModuleScore = useStore((s) => s.setModuleScore);

  const [items, setItems] = useState<SpeakingItem[]>([]);
  const [sel, setSel] = useState<SpeakingItem | null>(null);
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [chat, setChat] = useState(false);
  const recRef = useRef<Recognizer | null>(null);
  const asr = asrSupported();
  const tts = ttsSupported();

  useEffect(() => {
    api.learn<SpeakingItem[]>('speaking').then((d) => setItems(d.sort((a, b) => a.hsk - b.hsk))).catch(() => setItems([]));
  }, []);

  const open = (it: SpeakingItem) => {
    setSel(it);
    setHeard('');
    setScore(null);
    setTyped('');
    setTimeout(() => speak(it.target_zh), 200);
  };
  const finish = (txt: string) => {
    if (!sel || !txt.trim()) return;
    const sc = scoreSpeech(sel.target_zh, txt);
    setHeard(txt);
    setScore(sc);
    setModuleScore(`speaking:${sel.id}`, sc);
  };
  const startRec = () => {
    if (!sel) return;
    setHeard('');
    setScore(null);
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

  const scoreColor = (s: number) => (s >= 80 ? 'text-emerald-300' : s >= 60 ? 'text-gold' : 'text-amber-300');

  return (
    <ModuleShell icon="🗣️" titleKey="mod.speaking" subtitleKey="mod.speaking_d" wide>
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => open(it)}
            className={`px-3 py-2 rounded-xl text-sm transition ${sel?.id === it.id ? 'btn-primary' : 'glass hover:border-starcyan/60'}`}
          >
            <span className="text-[10px] text-starcyan mr-1">HSK{it.hsk}</span>
            {zh ? it.scene_zh : it.scene_en}
          </button>
        ))}
        {items.length === 0 && <p className="text-white/45 text-sm">{t('learn.empty')}</p>}
      </div>

      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-6">
            <p className="text-sm text-white/70">{zh ? sel.prompt_zh : sel.prompt_en}</p>

            {/* 跟读目标句 */}
            <div className="mt-4 bg-space-900/50 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-white/45 mb-1">{t('learn.target')}</p>
              <p className="text-xl text-gold leading-relaxed">{sel.target_zh}</p>
              <p className="text-sm text-starcyan/90 mt-1">{sel.target_pinyin}</p>
              <p className="text-xs text-white/55 mt-1">{sel.target_en}</p>
              <button onClick={() => speak(sel.target_zh)} disabled={!tts} className="mt-3 text-xs glass px-3 py-1.5 rounded-lg hover:border-starcyan/60 disabled:opacity-40">
                🔊 {t('learn.play')}
              </button>
            </div>

            {/* 录音跟读评分 */}
            <div className="mt-5 flex flex-col items-center gap-3">
              {asr ? (
                <button
                  onClick={recording ? stopRec : startRec}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium ${recording ? 'bg-red-500/80 animate-pulse' : 'btn-primary'}`}
                >
                  {recording ? `⏹ ${t('learn.stop')}` : `🎙 ${t('learn.record')}`}
                </button>
              ) : (
                <p className="text-xs text-amber-300/80">{t('learn.micUnsupported')}</p>
              )}

              {/* 打字兜底（无麦/演示用） */}
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
                <p className="text-sm text-white/70">
                  {t('learn.yourAnswer')}：<span className="text-white">{heard}</span>
                </p>
              )}
              {score !== null && (
                <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`text-lg font-bold ${scoreColor(score)}`}>
                  {t('learn.pronScore')} {score}
                </motion.div>
              )}
            </div>

            {/* 情境对话 */}
            <div className="mt-6 text-center border-t border-white/10 pt-5">
              <button onClick={() => setChat(true)} className="glass px-4 py-2 rounded-xl text-sm hover:border-gold/60 hover:text-gold">
                🎭 {t('learn.roleplay')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GradedChat
        open={chat}
        onClose={() => setChat(false)}
        contextTitle={sel?.scene_zh}
        contextText={sel ? (zh ? sel.prompt_zh : sel.prompt_en) : undefined}
        seedQuestion={sel?.target_zh}
      />
    </ModuleShell>
  );
}
