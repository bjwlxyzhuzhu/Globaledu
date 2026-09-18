import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { ZODIACS } from '../lib/zodiac';
import { speakSmart } from '../lib/speech';
import ZodiacImg from '../components/ZodiacImg';
import { flagUrl as localFlagUrl } from '../lib/flag';

// 进入前两步走：第一步选语言（中文必选 + 下拉添加英语等可选），第二步选数字老师。
const LANGS = [
  { code: 'en', label: 'English', flag: 'gb' },
  { code: 'fr', label: 'Français', flag: 'fr' },
  { code: 'es', label: 'Español', flag: 'es' },
  { code: 'ru', label: 'Русский', flag: 'ru' },
  { code: 'ar', label: 'العربية', flag: 'sa' },
  { code: 'de', label: 'Deutsch', flag: 'de' },
];
const flagUrl = (f: string) => localFlagUrl(f, 'w40');
const labelOf = (code: string) => LANGS.find((l) => l.code === code)?.label || code;
const flagOf = (code: string) => LANGS.find((l) => l.code === code)?.flag || '';

export default function LanguageSelect() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const setLanguages = useStore((s) => s.setLanguages);
  const uiLangs = useStore((s) => s.uiLangs);
  const zodiac = useStore((s) => s.zodiac);
  const setZodiac = useStore((s) => s.setZodiac);

  const [step, setStep] = useState<1 | 2>(1);
  // 预选当前已选的额外语言（中文之外）；首次默认带英语
  const [picked, setPicked] = useState<string[]>(uiLangs.filter((l) => l !== 'zh'));

  const addable = LANGS.filter((l) => !picked.includes(l.code));

  // 第一步「确定」：保存语言组合，进入第二步
  const confirmLangs = () => {
    setLanguages(picked); // 中文必含，picked 为额外语言（可为空）
    setStep(2);
  };

  // 选老师：记住 + 立刻用其绑定音色打招呼（声形绑定就地体验）
  const pickTeacher = (z: (typeof ZODIACS)[number]) => {
    setZodiac(z.id);
    speakSmart(`你好！我是${z.name_zh}老师，很高兴见到你！`, { lang: 'zh', voiceId: z.mmVoice, edgeVoice: z.edgeVoice, pitch: z.voice.pitch, rate: z.voice.rate });
  };

  const enter = () => {
    if (!zodiac) setZodiac(ZODIACS[0].id); // 未选则默认第一只
    nav('/?replay=1', { replace: true }); // 回到开场动画（完整重演：开场→地球）
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 grid place-items-center px-6 overflow-y-auto py-10">
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="glass rounded-3xl px-8 py-10 max-w-2xl w-full text-center"
      >
        <div className="text-5xl mb-4 animate-floaty">{step === 1 ? '🌐' : '🧑‍🏫'}</div>

        {/* 步骤指示 ①语言 → ②老师 */}
        <div className="flex items-center justify-center gap-2 mb-5 text-xs">
          <span className={step === 1 ? 'text-starcyan font-semibold' : 'text-white/40'}>① {t('lang.step1')}</span>
          <span className="text-white/25">→</span>
          <span className={step === 2 ? 'text-starcyan font-semibold' : 'text-white/40'}>② {t('lang.step2')}</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="s1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <h1 className="text-2xl font-bold text-glow mb-2">{t('lang.title')}</h1>
              <p className="text-sm text-white/65 mb-6">{t('lang.subtitle')}</p>

              {/* 已选语言：中文锁定必选 + 已添加的可移除 */}
              <div className="flex flex-wrap justify-center gap-2 mb-5">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-starcyan/15 border border-starcyan/50 text-sm">
                  <img src={flagUrl('cn')} className="w-5 h-auto rounded-sm" alt="" />
                  中文 <span className="text-[10px] text-starcyan/80 ml-0.5">{t('lang.required')}</span>
                </div>
                {picked.map((code) => (
                  <div key={code} className="flex items-center gap-2 px-3 py-2 rounded-xl btn-primary text-sm">
                    <img src={flagUrl(flagOf(code))} className="w-5 h-auto rounded-sm" alt="" />
                    {labelOf(code)}
                    <button onClick={() => setPicked((p) => p.filter((c) => c !== code))} className="ml-0.5 text-white/80 hover:text-white" title="移除 / Remove">
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* 下拉添加语言（英语及其它，可选、可多选） */}
              <div className="mb-8">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setPicked((p) => [...p, e.target.value]);
                  }}
                  disabled={addable.length === 0}
                  className="bg-space-800 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-starcyan/60 outline-none disabled:opacity-40 min-w-[220px]"
                >
                  <option value="">{t('lang.addLang')}</option>
                  {addable.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <button onClick={confirmLangs} className="btn-primary px-8 py-3 rounded-full font-semibold hover:opacity-90 transition">
                {t('lang.confirm')} →
              </button>
            </motion.div>
          ) : (
            <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
              <h1 className="text-2xl font-bold text-glow mb-1">{t('lang.teacher')}</h1>
              <p className="text-[11px] text-white/45 mb-5">{t('lang.teacherNote')}</p>

              <div className="grid grid-cols-6 gap-2 mb-8">
                {ZODIACS.map((z) => {
                  const on = (zodiac || ZODIACS[0].id) === z.id;
                  return (
                    <button
                      key={z.id}
                      onClick={() => pickTeacher(z)}
                      title={`${z.name_zh} · ${z.name_en}`}
                      className={`relative rounded-2xl p-1 border transition ${on ? 'border-transparent btn-primary scale-105' : 'glass hover:border-starviolet/60'}`}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden" style={{ background: z.color + '33' }}>
                        <ZodiacImg z={z} className="w-full h-full object-cover" emojiClassName="w-full h-full grid place-items-center text-2xl" />
                      </div>
                      <div className="text-[10px] mt-0.5 leading-tight">{z.emoji} {z.name_zh}</div>
                      {on && <span className="absolute -top-1.5 -right-1.5 text-xs">⭐</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setStep(1)} className="glass px-5 py-3 rounded-full text-sm hover:border-starcyan/60 transition">
                  ← {t('lang.back')}
                </button>
                <button onClick={enter} className="btn-primary px-8 py-3 rounded-full font-semibold hover:opacity-90 transition">
                  {t('lang.enter')} →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[11px] text-white/40 mt-5">{t('lang.note')}</p>
      </motion.div>
    </motion.div>
  );
}
