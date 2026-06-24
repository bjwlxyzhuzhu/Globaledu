import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from './Hud';

// 占位页：后续里程碑的页面先用它顶上，保证演示主线无死链。
export default function Placeholder({ title, milestone }: { title: string; milestone?: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
    >
      <Hud />
      <div className="glass rounded-3xl px-10 py-12 max-w-lg">
        <div className="text-6xl mb-5 animate-floaty">🚧</div>
        <h1 className="text-2xl font-semibold text-glow mb-3">{title}</h1>
        <p className="text-sm text-starcyan/90 mb-2">
          {t('common.comingSoon')}
          {milestone ? ` · ${milestone}` : ''}
        </p>
        <p className="text-sm text-white/55 leading-relaxed">{t('common.comingSoonNote')}</p>
        <div className="mt-8 flex gap-3 justify-center">
          <button
            onClick={() => nav(-1)}
            className="px-5 py-2 rounded-xl glass hover:border-starviolet/60 transition text-sm"
          >
            ← {t('common.back')}
          </button>
          <button
            onClick={() => nav('/globe')}
            className="px-5 py-2 rounded-xl btn-primary text-sm hover:opacity-90 transition"
          >
            🌏 {t('common.backToGlobe')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
