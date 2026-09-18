import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from './Hud';
import { BackButton } from './MapUI';

// 学习模块统一外壳：HUD + 返回模块舞台 + 居中标题。
export default function ModuleShell({
  icon,
  titleKey,
  subtitleKey,
  children,
  wide,
}: {
  icon: string;
  titleKey: string;
  subtitleKey?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen">
      <Hud />
      <BackButton to="/modules" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[45vh]"
        style={{ background: 'radial-gradient(55% 70% at 50% 0%, rgba(124,156,255,0.14), transparent 70%)' }}
      />
      <div className={`relative mx-auto px-6 pt-24 pb-20 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-glow">
            {icon} {t(titleKey)}
          </h1>
          {subtitleKey && <p className="mt-2 text-white/60 text-sm">{t(subtitleKey)}</p>}
        </div>
        {children}
      </div>
    </motion.div>
  );
}
