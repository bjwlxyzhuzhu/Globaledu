import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import ModuleShell from '../components/ModuleShell';
import GradedChat from '../components/GradedChat';
import { api } from '../lib/api';
import { regionColorRgba } from '../lib/regionColor';
import type { CultureItem } from '@shared/types';

// 文化八大主题板块（与 culture.json 的 category 对应）。标签中英内置、按界面语言切换。
const CATS: { key: string; emoji: string; zh: string; en: string }[] = [
  { key: 'heritage', emoji: '🏛', zh: '文物古迹', en: 'Relics & Sites' },
  { key: 'intangible', emoji: '🎭', zh: '非遗技艺', en: 'Intangible Heritage' },
  { key: 'festival', emoji: '🏮', zh: '节日节气', en: 'Festivals' },
  { key: 'food', emoji: '🍜', zh: '饮食茶酒', en: 'Food & Tea' },
  { key: 'folklore', emoji: '🪭', zh: '民俗风情', en: 'Folk Customs' },
  { key: 'art', emoji: '🖌', zh: '传统艺术', en: 'Traditional Arts' },
  { key: 'thought', emoji: '☯', zh: '思想哲学', en: 'Thought & Values' },
  { key: 'modern', emoji: '🚄', zh: '当代中国', en: 'Modern China' },
];

// 文化探索器（PRD §5）：类目 + 省份 + 关键词三重筛选，把全部文化卡变成可发现的中华文化图谱；
// 每卡可开 GradedChat 情境角色扮演。内容归属省份/城市（卡片显示「省·市」）。
export default function Culture() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const zh = i18n.language === 'zh';
  const [items, setItems] = useState<CultureItem[]>([]);
  const [cat, setCat] = useState<string>('all');
  const [prov, setProv] = useState<string>('all');
  const [q, setQ] = useState('');
  const [chat, setChat] = useState<{ title: string; seed: string } | null>(null);

  useEffect(() => {
    api.learn<CultureItem[]>('culture').then(setItems).catch(() => setItems([]));
  }, []);

  // 各分类计数（切换条角标）
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.category || 'modern'] = (m[it.category || 'modern'] || 0) + 1;
    return m;
  }, [items]);

  // 省份列表（按卡片数降序，供下拉筛选）
  const provinces = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.province || '全国'] = (m[it.province || '全国'] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items]);

  // 三重 AND 筛选：类目 + 省份 + 关键词（标题/正文/省市）
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== 'all' && (it.category || 'modern') !== cat) return false;
      if (prov !== 'all' && (it.province || '全国') !== prov) return false;
      if (query) {
        const hay = `${it.title_zh} ${it.title_en} ${it.body_zh} ${it.body_en} ${it.city || ''} ${it.province || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [items, cat, prov, q]);

  const provCount = provinces.length;

  return (
    <ModuleShell icon="🏮" titleKey="mod.culture" subtitleKey="mod.culture_d" wide>
      {/* 总览 + 文化知识闯关入口 */}
      {items.length > 0 && (
        <div className="flex flex-col items-center gap-2 mb-4">
          <p className="text-xs text-white/45 text-center">
            {zh
              ? `中华文化探索 · 共 ${items.length} 张文化卡 · 8 大主题 · 覆盖 ${provCount} 个省份/地区`
              : `Explore Chinese culture · ${items.length} cards · 8 themes · ${provCount} provinces/regions`}
          </p>
          <button onClick={() => nav('/module/culture-quiz')} className="btn-primary px-4 py-1.5 rounded-full text-xs font-semibold hover:opacity-90 transition">
            🎮 {zh ? '文化知识闯关' : 'Culture Quiz'}
          </button>
        </div>
      )}

      {/* 搜索 + 省份筛选 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={zh ? '搜索文化（如 昆曲、兵马俑、火锅…）' : 'Search culture (e.g. Kunqu, Terracotta, hotpot…)'}
            className="w-full bg-space-800 border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white/90 focus:border-starcyan/60 outline-none"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
              ×
            </button>
          )}
        </div>
        <select
          value={prov}
          onChange={(e) => setProv(e.target.value)}
          className="bg-space-800 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/90 focus:border-starcyan/60 outline-none sm:w-52"
        >
          <option value="all">{zh ? '全部省份/地区' : 'All provinces'}</option>
          {provinces.map(([p, n]) => (
            <option key={p} value={p}>
              {p}（{n}）
            </option>
          ))}
        </select>
      </div>

      {/* 八大主题切换条（横向滚动） */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-thin">
        <Chip active={cat === 'all'} onClick={() => setCat('all')} emoji="✨" label={zh ? '全部' : 'All'} count={items.length} />
        {CATS.map((c) => (
          <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)} emoji={c.emoji} label={zh ? c.zh : c.en} count={counts[c.key] || 0} />
        ))}
      </div>

      {/* 结果计数 + 清除筛选 */}
      <div className="flex items-center justify-between mb-4 text-xs text-white/45">
        <span>{zh ? `找到 ${shown.length} 张` : `${shown.length} found`}</span>
        {(cat !== 'all' || prov !== 'all' || q) && (
          <button
            onClick={() => {
              setCat('all');
              setProv('all');
              setQ('');
            }}
            className="text-starcyan hover:text-starcyan/80"
          >
            {zh ? '清除筛选' : 'Clear filters'}
          </button>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {shown.map((it, i) => {
          const place = [...new Set([it.province, it.city].filter(Boolean))].join('·');
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="glass rounded-3xl p-5 relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ background: regionColorRgba(it.title_zh, 0.85) }} />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-3xl mb-2">{it.emoji}</div>
                  <div className="flex items-center gap-1.5">
                    {it.hskRange && (
                      <span className="text-[10px] text-starcyan/90 bg-starcyan/10 rounded-full px-2 py-0.5">
                        HSK{it.hskRange[0]}{it.hskRange[1] !== it.hskRange[0] ? `–${it.hskRange[1]}` : ''}
                      </span>
                    )}
                    {place && <span className="text-[11px] text-white/45 bg-white/5 rounded-full px-2 py-0.5">📍 {place}</span>}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gold">
                  {it.title_zh} <span className="text-white/50 text-sm font-normal">{it.title_en}</span>
                </h3>
                <p className="text-sm text-white/85 mt-2 leading-relaxed">{zh ? it.body_zh : it.body_en}</p>
                {!zh && <p className="text-xs text-white/45 mt-1.5 leading-relaxed">{it.body_zh}</p>}
                {it.scenario_zh && (
                  <button
                    onClick={() => setChat({ title: it.title_zh, seed: zh ? it.scenario_zh! : it.scenario_en || it.scenario_zh! })}
                    className="btn-primary px-4 py-2 rounded-xl text-sm mt-4"
                  >
                    🎭 {t('learn.roleplay')}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        {shown.length === 0 && (
          <p className="text-white/45 text-sm text-center col-span-full py-8">{zh ? '没有匹配的文化卡，换个关键词或筛选试试。' : 'No matching cards — try another keyword or filter.'}</p>
        )}
      </div>

      <GradedChat open={!!chat} onClose={() => setChat(null)} contextTitle={chat?.title} contextText={chat?.seed} seedQuestion={chat?.seed} />
    </ModuleShell>
  );
}

// 主题切换芯片
function Chip({ active, onClick, emoji, label, count }: { active: boolean; onClick: () => void; emoji: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={
        'shrink-0 px-3.5 py-2 rounded-2xl text-sm whitespace-nowrap transition border ' +
        (active ? 'bg-gold/20 border-gold/60 text-gold font-semibold' : 'glass border-white/10 text-white/75 hover:text-white hover:border-white/25')
      }
    >
      <span className="mr-1">{emoji}</span>
      {label}
      <span className={'ml-1.5 text-xs ' + (active ? 'text-gold/70' : 'text-white/35')}>{count}</span>
    </button>
  );
}
