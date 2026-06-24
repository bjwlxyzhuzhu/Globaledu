import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { GeoJson } from '../lib/api';
import { tzLabel, centroidLng } from '../lib/tz';
import { CN_NAME } from '../lib/countryNames';

interface CountryRow {
  code: string;
  name: string;
  tz: string;
}
interface Props {
  geo: GeoJson | null;
  onSelect: (code: string, name: string, tz: string) => void;
}

// 大洲排序 + 中文名
const CONTINENT_ORDER = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania', 'Antarctica'];
const CONTINENT_ZH: Record<string, string> = {
  Asia: '亚洲',
  Europe: '欧洲',
  Africa: '非洲',
  'North America': '北美洲',
  'South America': '南美洲',
  Oceania: '大洋洲',
  Antarctica: '南极洲',
};

// 小国不好点 → 右上下拉：大洲 → 国家（首字母排序），国旗 + 英文名 + 时区。
export default function CountrySelect({ geo, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('Asia');

  const byContinent = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feats: any[] = ((geo as any)?.features as any[]) || [];
    const groups: Record<string, CountryRow[]> = {};
    const seen = new Set<string>();
    for (const f of feats) {
      const code: string = f.properties?.ISO_A2 || '';
      const name: string = f.properties?.NAME || '';
      if (!code || code === '-99' || code.length !== 2 || code === 'TW') continue; // 台湾并入中国，不单列
      if (seen.has(code)) continue;
      seen.add(code);
      const cont: string = f.properties?.CONTINENT || 'Other';
      (groups[cont] ||= []).push({ code, name, tz: tzLabel(code, centroidLng(f.geometry)) });
    }
    for (const k in groups) groups[k].sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [geo]);

  const continents = CONTINENT_ORDER.filter((c) => byContinent[c]?.length);
  const zh = i18n.language === 'zh';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 rounded-lg glass text-xs hover:border-starcyan/60 transition flex items-center gap-1.5"
      >
        🔎 {t('globe.selectCountry')} <span className="text-white/50">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 mt-2 w-72 max-h-[72vh] overflow-y-auto glass rounded-xl p-2 z-50"
          >
            {continents.map((cont) => (
              <div key={cont} className="mb-0.5">
                <button
                  onClick={() => setExpanded((e) => (e === cont ? null : cont))}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/5 text-sm font-semibold flex justify-between items-center"
                >
                  <span>{zh ? CONTINENT_ZH[cont] || cont : cont}</span>
                  <span className="text-white/40 text-xs">
                    {byContinent[cont].length} {expanded === cont ? '▾' : '▸'}
                  </span>
                </button>
                {expanded === cont && (
                  <div className="pl-1 pb-1">
                    {byContinent[cont].map((r) => (
                      <button
                        key={r.code}
                        onClick={() => {
                          onSelect(r.code, r.name, r.tz);
                          setOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-starviolet/15 text-xs transition"
                      >
                        <img
                          src={`https://flagcdn.com/w20/${r.code.toLowerCase()}.png`}
                          className="w-5 rounded-sm shrink-0"
                          alt=""
                        />
                        <span className="flex-1 text-left truncate">{zh ? CN_NAME[r.code] || r.name : r.name}</span>
                        {r.tz && <span className="text-[10px] text-starcyan/70 shrink-0">{r.tz}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
