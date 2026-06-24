import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

// 语言下拉（设置项之一）：列全部 7 种语言，选中即切换界面语言；若未在已选集合则自动加入（对话也会用该语言）。
const ALL = ['zh', 'en', 'fr', 'es', 'ru', 'ar', 'de'];
const NAME: Record<string, string> = { zh: '中文', en: 'English', fr: 'Français', es: 'Español', ru: 'Русский', ar: 'العربية', de: 'Deutsch' };
const SHORT: Record<string, string> = { zh: '中', en: 'EN', fr: 'FR', es: 'ES', ru: 'RU', ar: 'ع', de: 'DE' };

export default function LangSwitch() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const lang = useStore((s) => s.lang);
  const uiLangs = useStore((s) => s.uiLangs);
  const setLang = useStore((s) => s.setLang);
  const setLanguages = useStore((s) => s.setLanguages);
  const [open, setOpen] = useState(false);

  const pick = (l: string) => {
    if (l !== 'zh' && !uiLangs.includes(l)) setLanguages([...uiLangs.filter((x) => x !== 'zh'), l]); // 新语言加入已选集合
    setLang(l);
    i18n.changeLanguage(l);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-lg glass text-xs hover:border-starcyan/60 transition flex items-center gap-1"
        title={t('hud.lang')}
      >
        🌐 {SHORT[lang] || lang.toUpperCase()} <span className="text-[8px] opacity-60">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 min-w-[170px] glass rounded-xl border border-white/15 py-1 shadow-xl">
            <div className="px-3 py-1 text-[10px] text-white/35 uppercase tracking-wide">{t('hud.lang')}</div>
            {ALL.map((l) => (
              <button
                key={l}
                onClick={() => pick(l)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition flex items-center justify-between ${l === lang ? 'text-starcyan' : 'text-white/80'}`}
              >
                <span>
                  {NAME[l] || l}
                  {l === 'zh' && <span className="text-[9px] text-white/35 ml-1">{t('lang.required')}</span>}
                  {uiLangs.includes(l) && l !== lang && l !== 'zh' && <span className="text-[9px] text-starviolet/70 ml-1">●</span>}
                </span>
                {l === lang && <span>✓</span>}
              </button>
            ))}
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={() => {
                setOpen(false);
                nav('/language');
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gold hover:bg-white/10 transition"
            >
              ↻ {t('lang.reselect')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
