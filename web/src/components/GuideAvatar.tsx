import { motion, AnimatePresence } from 'framer-motion';

// 向导虚拟人：从下方滑入，带气泡提示。先用 emoji 立绘占位，后续可换 Lottie/插画。
export default function GuideAvatar({ message, show }: { message: string; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 140, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          className="fixed bottom-7 left-1/2 -translate-x-1/2 z-30 flex items-end gap-3"
        >
          <div className="text-5xl animate-floaty select-none">🧑‍🚀</div>
          <div className="glass rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs text-sm shadow-lg">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
