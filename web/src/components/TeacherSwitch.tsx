import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { ZODIACS, zodiacById } from '../lib/zodiac';
import { speakSmart } from '../lib/speech';
import ZodiacImg from './ZodiacImg';

// 数字老师下拉（设置项之一）：列 12 生肖老师，选中即更换专属老师并用其绑定音色打招呼。
export default function TeacherSwitch() {
  const { t, i18n } = useTranslation();
  const zodiac = useStore((s) => s.zodiac);
  const setZodiac = useStore((s) => s.setZodiac);
  const [open, setOpen] = useState(false);
  const cur = zodiacById(zodiac);
  const zh = i18n.language === 'zh';

  const pick = (z: (typeof ZODIACS)[number]) => {
    setZodiac(z.id);
    speakSmart(`你好！我是${z.name_zh}老师，很高兴见到你！`, { lang: 'zh', voiceId: z.mmVoice, edgeVoice: z.edgeVoice, pitch: z.voice.pitch, rate: z.voice.rate });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2.5 py-1.5 rounded-lg glass text-xs hover:border-starviolet/60 transition flex items-center gap-1"
        title={t('hud.teacher')}
      >
        <span>{cur.emoji}</span>
        <span className="hidden sm:inline">{zh ? cur.name_zh : cur.name_en}</span>
        <span className="text-[8px] opacity-60">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 w-[230px] glass rounded-xl border border-white/15 p-2 shadow-xl">
            <div className="px-1 py-1 text-[10px] text-white/35 uppercase tracking-wide">{t('hud.teacher')}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {ZODIACS.map((z) => {
                const on = cur.id === z.id;
                return (
                  <button
                    key={z.id}
                    onClick={() => pick(z)}
                    title={`${z.name_zh} · ${z.name_en}`}
                    className={`relative rounded-lg p-0.5 border transition ${on ? 'border-transparent btn-primary' : 'glass hover:border-starviolet/60'}`}
                  >
                    <div className="aspect-square rounded-md overflow-hidden" style={{ background: z.color + '33' }}>
                      <ZodiacImg z={z} className="w-full h-full object-cover" emojiClassName="w-full h-full grid place-items-center text-base" />
                    </div>
                    <div className="text-[9px] leading-tight mt-0.5">{z.name_zh}</div>
                    {on && <span className="absolute -top-1 -right-1 text-[10px]">⭐</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
