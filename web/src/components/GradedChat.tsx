import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { zodiacById, ZODIACS } from '../lib/zodiac';
import { speakSmart, stopSpeak, startListening, asrSupported } from '../lib/speech';
import ZodiacImg from './ZodiacImg';
import QuizPanel from './QuizPanel';
import type { ChatMessage, LevelCheck, HskLevel, ReplyItem } from '@shared/types';

interface Props {
  open: boolean;
  onClose: () => void;
  contextTitle?: string;
  contextText?: string;
  country?: string;
  seedQuestion?: string;
  topicTags?: { label: string; q: string }[]; // 快捷主题：景点/非遗/特产/美食
}

type Item =
  | { role: 'user'; content: string }
  | { role: 'assistant'; replies: ReplyItem[]; level?: LevelCheck; suggestions?: string[]; mock?: boolean; rag?: string[] };

const HSK_LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];
const LANG_LABEL: Record<string, string> = { zh: '中文', en: 'EN', fr: 'FR', es: 'ES', ru: 'RU', ar: 'AR', de: 'DE' };
const LANG_BCP: Record<string, string> = { zh: 'zh-CN', en: 'en-US', fr: 'fr-FR', es: 'es-ES', ru: 'ru-RU', ar: 'ar-SA', de: 'de-DE' };

// 分级·反谄媚·多语言 对话抽屉 + 生肖数字人老师（声形绑定）+ 语音输入/朗读。接 /api/chat（无 key 走 mock 兜底）。
export default function GradedChat({ open, onClose, contextTitle, contextText, country, seedQuestion, topicTags }: Props) {
  const { t } = useTranslation();
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);
  const uiLangs = useStore((s) => s.uiLangs);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const zodiac = useStore((s) => s.zodiac);
  const cultureTeacher = zodiacById(zodiac); // 🎓 文化导师 = 用户专属生肖
  const languageTeacher = ZODIACS[(ZODIACS.findIndex((z) => z.id === cultureTeacher.id) + 6) % ZODIACS.length]; // 📝 语言导师 = 互补的另一只生肖
  const [role, setRole] = useState<'culture' | 'language'>('culture');
  const teacher = role === 'culture' ? cultureTeacher : languageTeacher; // 当前激活导师（头像/音色/名字随角色切换）

  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [defModel, setDefModel] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false); // 出题练习面板（覆盖在对话上）
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<ReturnType<typeof startListening>>(null);

  useEffect(() => {
    if (open) {
      setItems([]);
      setInput(seedQuestion || '');
      setQuizOpen(false);
      setRole('culture');
    } else {
      stopSpeak();
      recRef.current?.stop();
      setListening(false);
      setSpeaking(false);
    }
  }, [open, seedQuestion]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, loading]);

  // 拉取可选大模型清单（一次）
  useEffect(() => {
    api.models().then((r) => { setModels(r.models); setDefModel(r.default); }).catch(() => {});
  }, []);

  // 用老师的绑定音色朗读一段文本（按 reply 的语言）
  const speakText = (text: string, lang = 'zh') => {
    stopSpeak();
    setSpeaking(true);
    // 优先 MiniMax 真人音色（生肖绑定）；未配置则回退浏览器 TTS
    speakSmart(text, {
      lang,
      voiceId: teacher.mmVoice,
      edgeVoice: teacher.edgeVoice,
      pitch: teacher.voice.pitch,
      rate: teacher.voice.rate,
      onend: () => setSpeaking(false),
    });
  };

  const send = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    const next: Item[] = [...items, { role: 'user', content: text }];
    setItems(next);
    setInput('');
    setLoading(true);

    const apiMessages: ChatMessage[] = [];
    if (contextText) {
      apiMessages.push({ role: 'user', content: `【参考资料：${contextTitle || ''}】${contextText.slice(0, 1200)}` });
      apiMessages.push({ role: 'assistant', content: '好的，我已读完这段资料，会据此用简单中文回答。' });
    }
    for (const it of next) {
      apiMessages.push(
        it.role === 'user'
          ? { role: 'user', content: it.content }
          : { role: 'assistant', content: it.replies.find((r) => r.lang === 'zh')?.text || it.replies[0]?.text || '' },
      );
    }

    try {
      const reply = await api.chat({ messages: apiMessages, hskLevel, country, outputLangs: uiLangs, model: model || undefined, role });
      setItems((prev) => [
        ...prev,
        { role: 'assistant', replies: reply.replies, level: reply.level_check, suggestions: reply.suggestions, mock: reply.mock, rag: reply.rag_titles },
      ]);
      // 老师用绑定音色朗读首条回复（按其语言）
      const first = reply.replies?.[0];
      if (autoSpeak && first) speakText(first.text, first.lang);
    } catch {
      setItems((prev) => [...prev, { role: 'assistant', replies: [{ lang: 'zh', text: '（出错了，请稍后再试）' }] }]);
    } finally {
      setLoading(false);
    }
  };

  // 语音输入（ASR）：识别结果填入输入框，最终结果自动发送
  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    if (!asrSupported()) return;
    setListening(true);
    recRef.current = startListening(
      {
        onResult: (text, final) => {
          setInput(text);
          if (final) {
            setListening(false);
            send(text);
          }
        },
        onError: () => setListening(false),
        onEnd: () => setListening(false),
      },
      uiLangs.includes('zh') ? 'zh-CN' : 'en-US',
    );
  };

  const avatar = (size: number) => (
    <ZodiacImg
      z={teacher}
      className="w-full h-full object-cover"
      emojiClassName="w-full h-full grid place-items-center"
      emojiStyle={{ background: teacher.color + '33', fontSize: size * 0.5 }}
    />
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-black/50" />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col glass border-l border-starviolet/30"
          >
            {/* 头部：数字人老师头像（说话脉动）+ 朗读开关 */}
            <div className="px-5 py-4 border-b border-white/10 flex items-start gap-3">
              <motion.div
                animate={speaking ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                transition={{ repeat: speaking ? Infinity : 0, duration: 0.6 }}
                className="w-12 h-12 rounded-full overflow-hidden border-2 shrink-0"
                style={{ borderColor: teacher.color, boxShadow: speaking ? `0 0 14px ${teacher.color}` : 'none' }}
              >
                {avatar(48)}
              </motion.div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-glow text-sm leading-tight">
                  {teacher.emoji} {teacher.name_zh}老师 · <span className="text-starcyan">{role === 'culture' ? '🎓 文化导师' : '📝 语言导师'}</span>
                </h3>
                <p className="text-[11px] text-starcyan/80 mt-0.5">{t('chat.subtitle')}</p>
                {contextTitle && (
                  <p className="text-[11px] text-white/55 mt-0.5 truncate">
                    {t('chat.context')}：<span className="text-gold">{contextTitle}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setQuizOpen(true)} title="出题练习 / Quiz" className="text-base opacity-80 hover:opacity-100 transition">
                  📝
                </button>
                <button
                  onClick={() => {
                    if (autoSpeak) stopSpeak();
                    setAutoSpeak((v) => !v);
                  }}
                  title={t('chat.autoSpeak')}
                  className={`text-lg transition ${autoSpeak ? 'opacity-100' : 'opacity-35'}`}
                >
                  {autoSpeak ? '🔊' : '🔇'}
                </button>
                <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">
                  ×
                </button>
              </div>
            </div>

            {/* 双师切换：🎓文化导师（知识问答）｜📝语言导师（纠错+出题），两个数字人，头像/音色/名字随之切 */}
            <div className="px-5 py-2 border-b border-white/10 flex items-center gap-2">
              <button
                onClick={() => setRole('culture')}
                className={`flex-1 text-[11px] py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${role === 'culture' ? 'btn-primary font-semibold' : 'glass hover:border-starcyan/60'}`}
              >
                {cultureTeacher.emoji} 🎓 文化导师
              </button>
              <button
                onClick={() => setRole('language')}
                className={`flex-1 text-[11px] py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${role === 'language' ? 'btn-primary font-semibold' : 'glass hover:border-starviolet/60'}`}
              >
                {languageTeacher.emoji} 📝 语言导师
              </button>
            </div>

            <div className="px-5 py-2 border-b border-white/10">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-white/50 mr-1">{t('chat.hsk')}</span>
                {HSK_LEVELS.map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setHskLevel(lv)}
                    className={`w-7 h-7 rounded-lg text-xs transition ${hskLevel === lv ? 'btn-primary font-bold' : 'glass hover:border-starcyan/60'}`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/40 mt-1">{t('chat.hskNote')}</p>
              {models.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[11px] text-white/50 mr-1">🧠 {t('chat.model')}</span>
                  <select
                    value={model || defModel}
                    onChange={(e) => setModel(e.target.value)}
                    title={t('chat.modelNote')}
                    className="flex-1 text-[11px] bg-space-900/80 border border-white/15 rounded-lg px-2 py-1 outline-none focus:border-starcyan/60 cursor-pointer"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-space-900 text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {items.length === 0 && !loading && <p className="text-sm text-white/45 text-center mt-6">{t('chat.empty')}</p>}
              {items.map((it, i) =>
                it.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm btn-primary px-3.5 py-2 text-sm">{it.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start gap-2">
                    <div className="w-7 h-7 rounded-full overflow-hidden border shrink-0 mt-0.5" style={{ borderColor: teacher.color }}>
                      {avatar(28)}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-space-700/80 border border-white/10 px-3.5 py-2.5 text-sm">
                      {it.replies.map((r, k) => (
                        <div key={k} dir={r.lang === 'ar' ? 'rtl' : 'ltr'} className={k > 0 ? 'mt-2 pt-2 border-t border-white/10' : ''}>
                          <span className="text-[9px] mr-1.5 px-1 py-0.5 rounded bg-starcyan/15 text-starcyan align-middle">
                            {LANG_LABEL[r.lang] || r.lang.toUpperCase()}
                          </span>
                          <span className={k === 0 ? 'leading-relaxed' : 'text-white/60 text-[13px]'}>{r.text}</span>
                          <button
                            onClick={() => speakText(r.text, r.lang)}
                            title={t('chat.play')}
                            className="ml-1.5 text-[11px] opacity-45 hover:opacity-100 transition align-middle"
                          >
                            🔊
                          </button>
                        </div>
                      ))}
                      {it.level && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-starcyan/15 text-starcyan">
                            {t('chat.sentenceLen')} {it.level.max_sentence_len}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${it.level.vocab_in_level ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                            {it.level.vocab_in_level
                              ? `✓ ${t('chat.inLevel')}`
                              : `⚠ ${t('chat.overLevel')}${it.level.over_words?.length ? '·' + it.level.over_words.slice(0, 4).join('') : ''}`}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${it.level.sycophancy_flag ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                            {it.level.sycophancy_flag ? `⚠ ${t('chat.sycoFlag')}` : `✓ ${t('chat.sycoOk')}`}
                          </span>
                          {it.level.taboo_flag && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">⚠ {t('chat.tabooFlag')}</span>}
                          {it.mock && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{t('chat.demo')}</span>}
                        </div>
                      )}
                      {it.suggestions && it.suggestions.length > 0 && (
                        <ul className="mt-2 text-[11px] text-white/55 list-disc list-inside space-y-0.5">
                          {it.suggestions.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ul>
                      )}
                      {it.rag && it.rag.length > 0 && (
                        <div className="mt-2 text-[10px] text-starviolet/90">📚 {t('chat.ragUsed')}：{it.rag.join('、')}</div>
                      )}
                    </div>
                  </div>
                ),
              )}
              {loading && <div className="text-sm text-white/50 pl-1">{t('chat.thinking')}</div>}
            </div>

            {/* 快捷主题标签：景点 / 非遗 / 特产 / 美食 */}
            {topicTags && topicTags.length > 0 && (
              <div className="px-4 pt-2 flex flex-wrap gap-1.5">
                {topicTags.map((tag) => (
                  <button
                    key={tag.label}
                    onClick={() => send(tag.q)}
                    disabled={loading}
                    className="text-[11px] px-2.5 py-1 rounded-full glass hover:border-gold/60 hover:text-gold transition disabled:opacity-40"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-white/10 flex items-end gap-2 mt-1">
              {asrSupported() && (
                <button
                  onClick={toggleMic}
                  title={t('chat.voiceInput')}
                  className={`px-3 py-2 rounded-xl text-base transition shrink-0 ${listening ? 'bg-red-500/30 text-red-200 animate-pulse' : 'glass hover:border-starcyan/60'}`}
                >
                  {listening ? '⏺' : '🎤'}
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder={listening ? t('chat.listening') : t('chat.placeholder')}
                className="flex-1 resize-none rounded-xl bg-space-900/70 border border-white/15 px-3 py-2 text-sm outline-none focus:border-starcyan/60"
              />
              <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-40">
                {t('chat.send')}
              </button>
            </div>

            {/* 出题练习面板（中文语言导师，覆盖在对话上） */}
            {quizOpen && <QuizPanel topic={contextTitle || '中国文化'} onClose={() => setQuizOpen(false)} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
