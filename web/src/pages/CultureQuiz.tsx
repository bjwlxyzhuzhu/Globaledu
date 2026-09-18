import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import GradedChat from '../components/GradedChat';
import ZodiacImg from '../components/ZodiacImg';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { zodiacById } from '../lib/zodiac';
import type { CultureItem } from '@shared/types';

const CAT_LABEL: Record<string, { zh: string; en: string }> = {
  heritage: { zh: '文物古迹', en: 'Relics & Sites' },
  intangible: { zh: '非遗技艺', en: 'Intangible Heritage' },
  festival: { zh: '节日节气', en: 'Festivals' },
  food: { zh: '饮食茶酒', en: 'Food & Tea' },
  folklore: { zh: '民俗风情', en: 'Folk Customs' },
  art: { zh: '传统艺术', en: 'Traditional Arts' },
  thought: { zh: '思想哲学', en: 'Thought & Values' },
  modern: { zh: '当代中国', en: 'Modern China' },
};

interface Quiz {
  q_zh: string;
  q_en: string;
  options: { zh: string; en: string }[];
  answer: number;
  card: CultureItem;
}

const N = 8; // 每轮题数
const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};
const sample = <T,>(arr: T[], k: number, exclude: T[]): T[] => shuffle(arr.filter((x) => !exclude.includes(x))).slice(0, k);

// 用 152 张文化卡自动生成选择题：省份 / 类目 / 城市 三种题型轮换，干扰项随机。
function buildQuiz(items: CultureItem[]): Quiz[] {
  const provinces = [...new Set(items.map((i) => i.province).filter((p): p is string => !!p && p !== '全国'))];
  const cities = [...new Set(items.map((i) => i.city).filter((c): c is string => !!c && c !== '全国'))];
  const cats = Object.keys(CAT_LABEL);
  const pool = shuffle(items);
  const qs: Quiz[] = [];
  for (let idx = 0; idx < pool.length && qs.length < N; idx++) {
    const card = pool[idx];
    const roll = qs.length % 3;
    let q: Quiz | null = null;
    if (roll === 0 && card.province && card.province !== '全国' && provinces.length >= 4) {
      const opts = shuffle([card.province, ...sample(provinces, 3, [card.province])]);
      q = { q_zh: `「${card.title_zh}」主要属于哪个省份 / 地区？`, q_en: `Which province/region is "${card.title_en}" mainly from?`, options: opts.map((o) => ({ zh: o, en: o })), answer: opts.indexOf(card.province), card };
    } else if (roll === 1 && card.category) {
      const four = shuffle([card.category, ...sample(cats, 3, [card.category])]);
      q = { q_zh: `「${card.title_zh}」属于下面哪个文化主题？`, q_en: `Which cultural theme does "${card.title_en}" belong to?`, options: four.map((c) => CAT_LABEL[c]), answer: four.indexOf(card.category), card };
    } else if (card.city && card.city !== '全国' && card.city !== card.province && cities.length >= 4) {
      const opts = shuffle([card.city, ...sample(cities, 3, [card.city])]);
      q = { q_zh: `「${card.title_zh}」是哪座城市的特色文化？`, q_en: `Which city is "${card.title_en}" a signature culture of?`, options: opts.map((o) => ({ zh: o, en: o })), answer: opts.indexOf(card.city), card };
    } else if (card.category) {
      const four = shuffle([card.category, ...sample(cats, 3, [card.category])]);
      q = { q_zh: `「${card.title_zh}」属于下面哪个文化主题？`, q_en: `Which cultural theme does "${card.title_en}" belong to?`, options: four.map((c) => CAT_LABEL[c]), answer: four.indexOf(card.category), card };
    }
    if (q && q.answer >= 0 && q.options.length === 4) qs.push(q);
  }
  return qs;
}

// 文化知识闯关：把 152 张文化卡变成可玩的选择题闯关，答错有解析，可向数字人老师追问，计分评价。
export default function CultureQuiz() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const [items, setItems] = useState<CultureItem[]>([]);
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [chat, setChat] = useState<{ title: string; seed: string } | null>(null);
  const setModuleScore = useStore((s) => s.setModuleScore);
  const teacher = zodiacById(useStore((s) => s.zodiac));

  useEffect(() => {
    api.learn<CultureItem[]>('culture').then(setItems).catch(() => setItems([]));
  }, []);

  const quiz = useMemo(() => (items.length ? buildQuiz(items) : []), [items, round]);
  const q = quiz[idx];

  const choose = (i: number) => {
    if (sel !== null) return; // 已答
    setSel(i);
    if (i === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (idx + 1 >= quiz.length) {
      const pct = Math.round((score / quiz.length) * 100);
      setModuleScore('culturequiz:best', pct);
      setDone(true);
    } else {
      setIdx((v) => v + 1);
      setSel(null);
    }
  };
  const restart = () => {
    setRound((r) => r + 1);
    setIdx(0);
    setSel(null);
    setScore(0);
    setDone(false);
  };

  const pct = quiz.length ? Math.round((score / quiz.length) * 100) : 0;
  const verdict = pct === 100 ? (zh ? '满分！中华文化达人 🏆' : 'Perfect! Culture master 🏆') : pct >= 70 ? (zh ? '很棒，文化感很强！🌟' : 'Great cultural sense! 🌟') : zh ? '继续探索，会越来越懂中国 💪' : 'Keep exploring China 💪';

  return (
    <ModuleShell icon="🎮" titleKey="mod.culturequiz" subtitleKey="mod.culturequiz_d">
      {quiz.length === 0 ? (
        <p className="text-white/45 text-sm text-center py-10">{t('learn.empty')}</p>
      ) : done ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-3xl p-8 text-center max-w-md mx-auto">
          <div className="text-5xl mb-3">{pct === 100 ? '🏆' : pct >= 70 ? '🌟' : '📚'}</div>
          <div className="text-4xl font-bold text-gold mb-1">{score}/{quiz.length}</div>
          <p className="text-white/70 mb-6">{verdict}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={restart} className="btn-primary px-6 py-2.5 rounded-full text-sm font-semibold">🔄 {zh ? '再来一轮' : 'Play again'}</button>
          </div>
        </motion.div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* 进度 + 老师 + 分数 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-starviolet/40">
                <ZodiacImg z={teacher} className="w-full h-full object-cover" emojiClassName="w-full h-full grid place-items-center text-base" emojiStyle={{ background: teacher.color + '33' }} />
              </div>
              <span className="text-xs text-white/55">{zh ? `第 ${idx + 1} / ${quiz.length} 题` : `${idx + 1} / ${quiz.length}`}</span>
            </div>
            <span className="text-xs text-gold">⭐ {score}</span>
          </div>
          {/* 进度条 */}
          <div className="h-1.5 rounded-full bg-white/10 mb-6 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-starcyan to-starviolet" animate={{ width: `${(idx / quiz.length) * 100}%` }} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={idx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <h2 className="text-xl font-semibold mb-5 leading-relaxed">{zh ? q.q_zh : q.q_en}</h2>
              <div className="grid gap-3">
                {q.options.map((o, i) => {
                  const isAns = i === q.answer;
                  const picked = sel === i;
                  const cls =
                    sel === null
                      ? 'glass hover:border-starcyan/60'
                      : isAns
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                        : picked
                          ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                          : 'glass opacity-60';
                  return (
                    <button key={i} onClick={() => choose(i)} disabled={sel !== null} className={`text-left px-4 py-3 rounded-2xl border transition ${cls}`}>
                      <span className="text-white/40 mr-2">{String.fromCharCode(65 + i)}.</span>
                      {zh ? o.zh : o.en}
                      {sel !== null && isAns && <span className="float-right">✓</span>}
                      {sel !== null && picked && !isAns && <span className="float-right">✗</span>}
                    </button>
                  );
                })}
              </div>

              {/* 解析 + 追问老师 + 下一题 */}
              <AnimatePresence>
                {sel !== null && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 glass rounded-2xl p-4">
                    <p className="text-sm text-white/80 leading-relaxed">
                      <span className="text-gold font-semibold">{q.card.emoji} {q.card.title_zh}</span>
                      <span className="text-white/45"> · {q.card.province}{q.card.city && q.card.city !== q.card.province ? '·' + q.card.city : ''}</span>
                      <br />
                      {zh ? q.card.body_zh : q.card.body_en}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setChat({ title: q.card.title_zh, seed: zh ? `请用简单的中文给我讲讲「${q.card.title_zh}」。` : `Tell me about "${q.card.title_en}" in simple Chinese.` })}
                        className="text-xs glass px-3 py-1.5 rounded-lg hover:border-starviolet/60 transition"
                      >
                        🎭 {zh ? `问问${teacher.name_zh}老师` : 'Ask the teacher'}
                      </button>
                      <button onClick={next} className="text-xs btn-primary px-4 py-1.5 rounded-lg ml-auto font-semibold">
                        {idx + 1 >= quiz.length ? (zh ? '查看成绩 →' : 'See score →') : zh ? '下一题 →' : 'Next →'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <GradedChat open={!!chat} onClose={() => setChat(null)} contextTitle={chat?.title} seedQuestion={chat?.seed} />
    </ModuleShell>
  );
}
