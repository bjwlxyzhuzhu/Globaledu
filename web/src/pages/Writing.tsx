import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import GuidedTour, { type TourStep } from '../components/GuidedTour';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import type { WritingItem, WritingGrade, WritingRecord, HskLevel } from '@shared/types';

// 写作模块功能导览
const WRITING_TOUR: TourStep[] = [
  { sel: '[data-tour="w-hsk"]', title: { zh: '🎚 选 HSK 等级', en: 'Pick HSK level' }, desc: { zh: '先选你的 HSK 等级，下面的写作命题会按难度筛选（HSK1 介绍自己 → HSK6 议论文）。', en: 'Pick your HSK level; the prompts below are filtered by difficulty.' } },
  { sel: '[data-tour="w-prompts"]', title: { zh: '✍️ 选命题写作', en: 'Pick a prompt' }, desc: { zh: '选一个命题，下面会出现写作框。写完点「提交批改」，AI 语言导师会从内容/语法/词汇/连贯四维打分、逐句纠错并给范文。', en: 'Pick a prompt, write, then submit. The AI tutor grades on 4 dimensions, corrects sentences, and shows a sample.' } },
  { sel: '[data-tour="w-history"]', title: { zh: '📚 我的写作记录', en: 'My writing history' }, desc: { zh: '登录后，每次批改的原文与评分都会自动保存在这里，可随时回看进步；老师也能在后台看到你的写作学情。', en: 'Once signed in, every graded essay is saved here to review your progress; teachers can see it too.' } },
];

const LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];
const onlyZh = (s: string) => (s.match(/[一-鿿]/g) || []).length;

// 写作模块：分级命题 → 学生写作 → AI 四维批改（内容/语法/词汇/连贯）+ 逐条纠错 + 总评 + 范文。
// 计分写入 moduleProgress 的 writing:<id>，对应能力雷达「写作」维度（MODULE_DIM writing→write）。
export default function Writing() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const hskLevel = useStore((s) => s.hskLevel);
  const setHskLevel = useStore((s) => s.setHskLevel);
  const setModuleScore = useStore((s) => s.setModuleScore);
  const currentUser = useStore((s) => s.currentUser);
  const model = useStore((s) => s.model);
  const uiLangs = useStore((s) => s.uiLangs);
  const nativeName = useMemo(() => {
    const NAME: Record<string, string> = { en: 'English', fr: 'Français', es: 'Español', ru: 'Русский', ar: 'العربية', de: 'Deutsch' };
    const ex = uiLangs.find((l) => l !== 'zh');
    return ex ? NAME[ex] || 'English' : 'English';
  }, [uiLangs]);

  const [items, setItems] = useState<WritingItem[]>([]);
  const [sel, setSel] = useState<WritingItem | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<WritingGrade | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [err, setErr] = useState('');
  const [history, setHistory] = useState<WritingRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [openRec, setOpenRec] = useState<string | null>(null);

  useEffect(() => {
    api.learn<WritingItem[]>('writing').then((d) => setItems(d.sort((a, b) => a.hsk - b.hsk))).catch(() => setItems([]));
  }, []);

  // 登录学生：拉取写作历史
  const loadHistory = () => {
    if (!currentUser) return;
    api.writingHistory().then((r) => setHistory(r.writings)).catch(() => {});
  };
  useEffect(loadHistory, [currentUser]);

  const shown = items.filter((it) => it.hsk <= hskLevel);
  useEffect(() => {
    if (sel && sel.hsk > hskLevel) { setSel(null); setGrade(null); }
  }, [hskLevel, sel]);

  const open = (it: WritingItem) => {
    setSel(it);
    setText('');
    setGrade(null);
    setShowSample(false);
    setErr('');
  };

  const len = onlyZh(text);

  const submit = async () => {
    if (!sel || len < 5) {
      setErr(zh ? '请至少写 5 个汉字再提交。' : 'Write at least 5 Chinese characters first.');
      return;
    }
    setErr('');
    setBusy(true);
    setGrade(null);
    try {
      const g = await api.writingGrade({ text, hskLevel: sel.hsk, prompt: sel.prompt_zh, nativeLang: nativeName, minChars: sel.minChars, itemId: sel.id, title: sel.title_zh, model });
      setGrade(g);
      setModuleScore(`writing:${sel.id}`, g.score); // 记入能力雷达「写作」维度
      loadHistory(); // 登录学生：刷新写作历史
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const DIM_LABEL: Record<string, string> = zh
    ? { content: '内容', grammar: '语法', vocab: '词汇', coherence: '连贯' }
    : { content: 'Content', grammar: 'Grammar', vocab: 'Vocabulary', coherence: 'Coherence' };

  return (
    <ModuleShell icon="✍️" titleKey="mod.writing" subtitleKey="mod.writing_d">
      {/* HSK 等级筛选 */}
      <div data-tour="w-hsk" className="flex items-center justify-center gap-2 mb-5">
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

      {/* 命题选择 */}
      <div data-tour="w-prompts" className="flex flex-wrap justify-center gap-2 mb-6">
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
        {shown.length === 0 && <p className="text-white/45 text-sm">{zh ? '该等级暂无命题，调高等级试试。' : 'No prompts at this level — try a higher level.'}</p>}
      </div>

      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-6">
            {/* 题目 + 要点提示 */}
            <h3 className="font-semibold text-gold text-lg">
              {sel.title_zh} <span className="text-white/45 text-sm font-normal">{sel.title_en}</span>
            </h3>
            <p className="text-sm text-white/85 mt-2 leading-relaxed">{zh ? sel.prompt_zh : sel.prompt_en}</p>
            {!zh && <p className="text-xs text-white/45 mt-1">{sel.prompt_zh}</p>}
            {sel.hint_zh && (
              <p className="text-xs text-starcyan/80 mt-2 bg-starcyan/5 rounded-lg px-3 py-2">
                💡 {zh ? sel.hint_zh : sel.hint_en || sel.hint_zh}
              </p>
            )}

            {/* 写作区 */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={zh ? '在这里用中文写作…' : 'Write in Chinese here…'}
              rows={7}
              className="w-full mt-4 bg-space-900/70 border border-white/15 rounded-2xl px-4 py-3 text-base leading-relaxed text-white/90 outline-none focus:border-starcyan/60 resize-y"
            />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className={len >= sel.minChars ? 'text-emerald-300' : 'text-white/45'}>
                {zh ? '已写' : 'Written'} {len} {zh ? '字' : 'chars'} · {zh ? '建议' : 'suggest'} ≥ {sel.minChars}
              </span>
              <button onClick={submit} disabled={busy} className="btn-primary px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                {busy ? (zh ? 'AI 批改中…' : 'Grading…') : `📝 ${zh ? '提交批改' : 'Submit'}`}
              </button>
            </div>
            {err && <p className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2 mt-2">{err}</p>}

            {/* 批改结果 */}
            <AnimatePresence>
              {grade && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border-t border-white/10 pt-5">
                  {/* 综合分 + 四维 */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gold leading-none">{grade.score}</div>
                      <div className="text-[11px] text-white/45 mt-1">{zh ? '综合' : 'Overall'}/100</div>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                      {(['content', 'grammar', 'vocab', 'coherence'] as const).map((k) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="w-10 text-white/60">{DIM_LABEL[k]}</span>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-starcyan/70" style={{ width: `${grade.dims[k]}%` }} />
                          </div>
                          <span className="w-7 text-right text-starcyan">{grade.dims[k]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 总评 */}
                  <div className="mt-4 bg-space-900/50 rounded-2xl px-4 py-3">
                    <p className="text-sm text-white/85 leading-relaxed">🎓 {grade.comment_zh}</p>
                    {!zh && grade.comment_native && grade.comment_native !== grade.comment_zh && (
                      <p className="text-xs text-white/55 leading-relaxed mt-2">{grade.comment_native}</p>
                    )}
                    {grade.mock && <p className="text-[11px] text-amber-300/80 mt-2">{zh ? '（演示批改，连接大模型后为逐句真实批改）' : '(Demo grading — connect the AI model for sentence-level feedback)'}</p>}
                  </div>

                  {/* 逐条纠错 */}
                  {grade.corrections.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs text-white/50 mb-2">✏️ {zh ? '修改建议' : 'Corrections'}</h4>
                      <div className="space-y-2">
                        {grade.corrections.map((c, i) => (
                          <div key={i} className="text-sm bg-white/5 rounded-xl px-3 py-2">
                            <div>
                              <span className="text-red-300/90 line-through">{c.original}</span>
                              <span className="mx-2 text-white/40">→</span>
                              <span className="text-emerald-300">{c.fixed}</span>
                            </div>
                            <p className="text-xs text-white/55 mt-1">{zh ? c.note_zh : c.note_en || c.note_zh}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 范文 */}
                  {sel.sample_zh && (
                    <div className="mt-4">
                      <button onClick={() => setShowSample((v) => !v)} className="glass px-4 py-2 rounded-xl text-sm hover:border-gold/60">
                        {showSample ? (zh ? '收起范文' : 'Hide sample') : `📄 ${zh ? '看参考范文' : 'View sample essay'}`}
                      </button>
                      {showSample && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-white/80 text-sm leading-relaxed whitespace-pre-wrap bg-space-900/50 rounded-2xl px-4 py-3">
                          {sel.sample_zh}
                        </motion.p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 我的写作记录（登录学生）：每次批改都已保存，可回看原文与批改 */}
      {currentUser && history.length > 0 && (
        <div className="mt-6" data-tour="w-history">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full glass rounded-2xl px-4 py-3 text-left text-sm hover:border-starcyan/60 flex items-center justify-between"
          >
            <span>📚 {zh ? '我的写作记录' : 'My writing history'} <span className="text-white/45">({history.length})</span></span>
            <span className="text-white/40">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {history.map((r) => (
                <div key={r.id} className="glass rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenRec((id) => (id === r.id ? null : r.id))}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-white/5"
                  >
                    <span className="text-white/85">{r.title || (zh ? '写作' : 'Essay')}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-gold font-semibold">{r.score}</span>
                      <span className="text-[11px] text-white/40">{new Date(r.ts).toLocaleDateString(zh ? 'zh-CN' : 'en-US')}</span>
                    </span>
                  </button>
                  {openRec === r.id && (
                    <div className="px-4 pb-3 border-t border-white/10 pt-3">
                      <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap bg-space-900/50 rounded-xl px-3 py-2">{r.text}</p>
                      <div className="flex gap-3 flex-wrap mt-2 text-[11px] text-white/55">
                        <span>内容 {r.dims.content}</span>
                        <span>语法 {r.dims.grammar}</span>
                        <span>词汇 {r.dims.vocab}</span>
                        <span>连贯 {r.dims.coherence}</span>
                      </div>
                      {r.comment_zh && <p className="text-xs text-white/70 mt-2 leading-relaxed">🎓 {r.comment_zh}</p>}
                      {r.corrections.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {r.corrections.map((c, i) => (
                            <div key={i} className="text-xs">
                              <span className="text-red-300/90 line-through">{c.original}</span>
                              <span className="mx-1.5 text-white/40">→</span>
                              <span className="text-emerald-300">{c.fixed}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {currentUser === null && (
        <p data-tour="w-history" className="text-center text-[11px] text-white/35 mt-6">{zh ? '登录后，每次写作批改都会自动保存，可随时回看。' : 'Sign in to save and review every graded essay.'}</p>
      )}

      <GuidedTour id="writing" steps={WRITING_TOUR} />
    </ModuleShell>
  );
}
