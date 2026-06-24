import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Curtain from '../components/Curtain';
import GuideAvatar from '../components/GuideAvatar';
import { useStore } from '../store/useStore';

// 多语母语欢迎语（开场轮播，增添国际感）
const NATIVE_WELCOMES = [
  '欢迎来到寰语星球',
  'Welcome to Huanyu Planet',
  'Selamat datang',
  'ยินดีต้อนรับ',
  'Добро пожаловать',
  'مرحبا بكم',
  'Chào mừng',
];

export default function Opening() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const openingSeen = useStore((s) => s.openingSeen);
  const langChosen = useStore((s) => s.langChosen);
  const markOpeningSeen = useStore((s) => s.markOpeningSeen);

  // phase: 0 星光 → 1 帷幕拉开 → 2 地球显现 → 3 欢迎语 → 4 向导登场
  const [phase, setPhase] = useState(0);
  const [welcomeIdx, setWelcomeIdx] = useState(0);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    markOpeningSeen();
    nav('/globe', { replace: true });
  }, [markOpeningSeen, nav]);

  useEffect(() => {
    // 首次进入：先选择语言
    if (!langChosen) {
      nav('/language', { replace: true });
      return;
    }
    // 已看过且非「?replay=1」强制重看 → 默认跳过（PRD §3）
    if (openingSeen && !params.has('replay')) {
      nav('/globe', { replace: true });
      return;
    }
    const timers = [
      window.setTimeout(() => setPhase(1), 800),
      window.setTimeout(() => setPhase(2), 1600),
      window.setTimeout(() => setPhase(3), 2400),
      window.setTimeout(() => setPhase(4), 3800),
      window.setTimeout(() => finish(), 7200),
    ];
    const cycle = window.setInterval(
      () => setWelcomeIdx((i) => (i + 1) % NATIVE_WELCOMES.length),
      1300,
    );
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(cycle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden" onClick={() => phase >= 3 && finish()}>
      {/* 跳过按钮（常驻） */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        className="fixed top-5 right-5 z-40 px-4 py-1.5 rounded-full glass text-xs hover:border-starcyan/60 transition"
      >
        {t('opening.skip')} ⏭
      </button>

      {/* 后景层（被帷幕遮挡，拉开后显现）：星球 + 欢迎语 */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6">
        {/* CSS 星球（轻量，真实 globe.gl 在 /globe） */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="relative mb-8"
            >
              <div
                className="w-44 h-44 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 35% 30%, #1b3a6b, #0a1a3a 55%, #05060f 100%)',
                  boxShadow:
                    '0 0 60px rgba(63,210,255,0.45), inset -16px -16px 40px rgba(0,0,0,0.6)',
                }}
              />
              {/* 自转光环 */}
              <motion.div
                className="absolute inset-[-18px] rounded-full border border-starcyan/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 16, ease: 'linear', repeat: Infinity }}
                style={{ borderTopColor: 'rgba(245,197,66,0.6)' }}
              />
              {/* 聚光 */}
              <div
                className="absolute inset-[-40px] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(245,197,66,0.18), transparent 70%)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="text-3xl md:text-4xl font-bold text-glow mb-2">{t('opening.welcome')}</h1>
              <p className="text-sm md:text-base text-white/70 mb-3">{t('opening.subtitle')}</p>
              <div className="h-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={welcomeIdx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-starcyan/80 text-sm"
                  >
                    {NATIVE_WELCOMES[welcomeIdx]}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 进入按钮 */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={(e) => {
                e.stopPropagation();
                finish();
              }}
              className="mt-9 btn-primary px-7 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition"
            >
              {t('opening.enter')} →
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 初始星光（帷幕之上，渐隐） */}
      <AnimatePresence>
        {phase < 2 && (
          <motion.div
            className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 0.9] }}
            exit={{ opacity: 0, scale: 2 }}
            transition={{ duration: 1.4 }}
          >
            <div
              className="w-6 h-6 rounded-full"
              style={{ background: '#fff', boxShadow: '0 0 40px 14px rgba(63,210,255,0.8)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 帷幕 / 星门 */}
      <Curtain open={phase >= 1} />

      {/* 向导虚拟人 */}
      <GuideAvatar message={t('opening.guide')} show={phase >= 4} />
    </div>
  );
}
