import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangSwitch from './LangSwitch';
import TeacherSwitch from './TeacherSwitch';

// 顶部 HUD：Logo「寰语星球」+ Studio + 语言下拉 + 数字老师下拉 + 我的画像（语言/老师两个独立下拉，不再用单一「重选」按钮）
export default function Hud() {
  const nav = useNavigate();
  const { t } = useTranslation();
  return (
    <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-5 py-3">
      <button onClick={() => nav('/globe')} className="flex items-center gap-2 group">
        <span className="text-xl">🌐</span>
        <span className="font-semibold tracking-wide text-glow group-hover:text-starcyan transition">
          {t('app.name')}
        </span>
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav('/studio')}
          className="px-3 py-1.5 rounded-lg glass text-xs hover:border-gold/60 transition"
          title={t('hud.studio')}
        >
          🎬
        </button>
        <LangSwitch />
        <TeacherSwitch />
        <button
          onClick={() => nav('/profile')}
          className="w-8 h-8 rounded-full btn-primary grid place-items-center text-sm"
          title={t('hud.profile')}
        >
          👤
        </button>
      </div>
    </header>
  );
}
