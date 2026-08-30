import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

// 一步：sel=目标元素选择器（建议用 data-tour）；title/desc 中英双语对象。
export interface TourStep {
  sel: string;
  title: { zh: string; en: string };
  desc: { zh: string; en: string };
}

function lsGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

const CARD_W = 300;
const STEP_MS = 4600; // 每步自动停留时长

// 新手功能导览：进入页面时虚拟鼠标自动移动到各功能，聚光灯高亮 + 动画说明卡逐个介绍。
// 整层 pointer-events:none（说明卡按钮除外），纯视觉引导、不阻断操作。首访自动播放，可随时「功能导览」重播。
export default function GuidedTour({ id, steps, autoStart = true }: { id: string; steps: TourStep[]; autoStart?: boolean }) {
  const { i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const seenKey = 'hyxq_tour_' + id;

  // 首访自动开始（延迟，等页面渲染完）
  useEffect(() => {
    if (!autoStart) return;
    if (lsGet(seenKey) === '1') return;
    const t = window.setTimeout(() => {
      setI(0);
      setActive(true);
    }, 800);
    return () => window.clearTimeout(t);
  }, [seenKey, autoStart]);

  // 量取当前步目标位置（滚动到可见后再测，随窗口变化重测）
  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    const measure = () => {
      const el = steps[i] ? (document.querySelector(steps[i].sel) as HTMLElement | null) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    };
    const el = steps[i] ? (document.querySelector(steps[i].sel) as HTMLElement | null) : null;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    raf = window.setTimeout(measure, 380); // 等滚动停下
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, i, steps]);

  // 自动前进
  useEffect(() => {
    if (!active || paused) return;
    timer.current = window.setTimeout(() => go(i + 1), STEP_MS);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, i, paused]);

  const finish = () => {
    setActive(false);
    lsSet(seenKey, '1');
  };
  const go = (n: number) => {
    if (n < 0) return;
    if (n >= steps.length) return finish();
    setI(n);
  };
  const replay = () => {
    setI(0);
    setActive(true);
  };

  // 说明卡位置：目标在上半屏→卡放下方，否则放上方；水平居中并夹在视口内。
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let cardLeft = vw / 2 - CARD_W / 2;
  let cardTop = vh / 2;
  let cursorX = vw / 2;
  let cursorY = vh / 2;
  if (rect) {
    cursorX = rect.left + rect.width * 0.5;
    cursorY = rect.top + rect.height * 0.6;
    cardLeft = Math.min(Math.max(rect.left + rect.width / 2 - CARD_W / 2, 12), vw - CARD_W - 12);
    const below = rect.top < vh * 0.5;
    cardTop = below ? rect.top + rect.height + 22 : rect.top - 14 - 150;
    cardTop = Math.min(Math.max(cardTop, 12), vh - 170);
  }

  const step = steps[i];

  return (
    <>
      {/* 重播入口：左下角小按钮，始终可点 */}
      <button
        onClick={replay}
        className="fixed bottom-4 left-4 z-40 glass rounded-full px-3 py-1.5 text-xs text-white/80 hover:text-white hover:border-starcyan/60 transition"
        title={zh ? '功能导览' : 'Guided tour'}
      >
        🧭 {zh ? '功能导览' : 'Tour'}
      </button>

      <AnimatePresence>
        {active && step && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] pointer-events-none">
            {/* 聚光灯：暗色蒙版 + 目标处镂空 */}
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <mask id={`tourmask-${id}`}>
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  {rect && (
                    <rect
                      x={rect.left - 8}
                      y={rect.top - 8}
                      width={rect.width + 16}
                      height={rect.height + 16}
                      rx="14"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="rgba(3,7,20,0.58)" mask={`url(#tourmask-${id})`} />
            </svg>

            {/* 高亮脉冲环 */}
            {rect && (
              <motion.div
                className="absolute rounded-2xl border-2 border-starcyan"
                style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }}
                animate={{ boxShadow: ['0 0 0 0 rgba(63,210,255,0.55)', '0 0 0 12px rgba(63,210,255,0)'] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
              />
            )}

            {/* 自动移动的虚拟鼠标 */}
            <motion.div
              className="absolute text-3xl select-none"
              style={{ left: 0, top: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
              animate={{ x: cursorX - 6, y: cursorY - 6, scale: [1, 0.82, 1] }}
              transition={{ x: { type: 'spring', stiffness: 120, damping: 18 }, y: { type: 'spring', stiffness: 120, damping: 18 }, scale: { duration: 0.5, delay: 0.45 } }}
            >
              👆
            </motion.div>

            {/* 说明卡 */}
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              className="absolute glass rounded-2xl p-4 pointer-events-auto shadow-2xl border border-starcyan/30"
              style={{ left: cardLeft, top: cardTop, width: CARD_W }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-starcyan/80 font-medium">
                  {zh ? '功能导览' : 'Guided tour'} · {i + 1}/{steps.length}
                </span>
                <button onClick={finish} className="text-white/45 hover:text-white text-xs">
                  {zh ? '跳过 ✕' : 'Skip ✕'}
                </button>
              </div>
              <h4 className="text-sm font-semibold text-gold">{zh ? step.title.zh : step.title.en}</h4>
              <p className="text-xs text-white/80 mt-1.5 leading-relaxed">{zh ? step.desc.zh : step.desc.en}</p>

              {/* 进度点 + 上/下一步 */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1">
                  {steps.map((_, k) => (
                    <span key={k} className={'w-1.5 h-1.5 rounded-full ' + (k === i ? 'bg-starcyan' : 'bg-white/25')} />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {i > 0 && (
                    <button onClick={() => go(i - 1)} className="glass px-2.5 py-1 rounded-lg text-xs hover:border-white/30">
                      {zh ? '上一步' : 'Back'}
                    </button>
                  )}
                  <button onClick={() => go(i + 1)} className="btn-primary px-3 py-1 rounded-lg text-xs font-semibold">
                    {i + 1 >= steps.length ? (zh ? '完成' : 'Done') : zh ? '下一步' : 'Next'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
