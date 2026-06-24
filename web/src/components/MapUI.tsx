import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

// 地图系页面共用的小部件：返回按钮 / 轻提示 / 加载态

export function BackButton({ to, label }: { to: string; label?: string }) {
  const nav = useNavigate();
  const { t } = useTranslation();
  return (
    <button
      onClick={() => nav(to)}
      className="fixed top-16 left-5 z-30 px-4 py-1.5 rounded-full glass text-xs hover:border-starcyan/60 transition"
    >
      ← {label ?? t('common.back')}
    </button>
  );
}

export function Toast({ text }: { text: string }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 glass rounded-full px-5 py-2 text-sm"
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Loading({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="glass rounded-2xl px-6 py-4 text-sm flex items-center gap-3">
        <span className="w-4 h-4 rounded-full border-2 border-starcyan/30 border-t-starcyan animate-spin" />
        {text ?? t('map.loading')}
      </div>
    </div>
  );
}
