import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton, Toast, Loading } from '../components/MapUI';
import GradedChat from '../components/GradedChat';
import { api } from '../lib/api';
import { CN_NAME } from '../lib/countryNames';
import { cityHeroKw } from '../lib/cityImage';
import CityImg from '../components/CityImg';
import { regionColorRgba } from '../lib/regionColor';
import FocusMap from '../components/FocusMap';
import { useStore } from '../store/useStore';
import type { KbDoc, CityPedia, CityPediaItem, CultureItem } from '@shared/types';

// 文化主题分类标签（与 Culture 模块一致）
const CAT_LABEL: Record<string, { emoji: string; zh: string; en: string }> = {
  heritage: { emoji: '🏛', zh: '文物古迹', en: 'Relics' },
  intangible: { emoji: '🎭', zh: '非遗技艺', en: 'Intangible' },
  festival: { emoji: '🏮', zh: '节日节气', en: 'Festival' },
  food: { emoji: '🍜', zh: '饮食茶酒', en: 'Food' },
  folklore: { emoji: '🪭', zh: '民俗风情', en: 'Folk' },
  art: { emoji: '🖌', zh: '传统艺术', en: 'Arts' },
  thought: { emoji: '☯', zh: '思想哲学', en: 'Thought' },
  modern: { emoji: '🚄', zh: '当代中国', en: 'Modern' },
};

type Mode = 'country' | 'place' | 'city';
interface PlaceInfo {
  zh: string;
  en?: string;
  intro?: string;
  flag?: string; // 国家码（国家页显示国旗）
}

// 城市图鉴卡（景点 / 美食）：AI 配图 + 双语 + 点开与该城智能体对话；图加载失败降级为渐变+emoji。
function PediaCard({
  item,
  zh,
  fallback,
  chatLabel,
  onChat,
}: {
  item: CityPediaItem;
  zh: boolean;
  fallback: string;
  chatLabel: string;
  onChat: (name: string) => void;
}) {
  return (
    <motion.div whileHover={{ y: -4 }} className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="h-36 relative" style={{ background: regionColorRgba(item.name_zh, 0.4) }}>
        <CityImg
          kw={item.img}
          w={480}
          h={300}
          model="turbo"
          alt={item.name_zh}
          className="absolute inset-0 w-full h-full object-cover"
          fallback={<div className="absolute inset-0 grid place-items-center text-4xl opacity-80">{fallback}</div>}
        />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-semibold leading-snug">
          {item.name_zh}
          {item.name_en && <span className="block text-[11px] text-white/45 font-normal mt-0.5">{item.name_en}</span>}
        </h4>
        <p className="mt-1.5 text-xs text-white/60 flex-1 line-clamp-3">{zh ? item.desc_zh : item.desc_en}</p>
        <button onClick={() => onChat(item.name_zh)} className="mt-3 self-start text-xs btn-primary px-3 py-1.5 rounded-lg">
          💬 {chatLabel}
        </button>
      </div>
    </motion.div>
  );
}

// 城市/地区/国家 文化页：英雄图 + 城市文化/景点/美食图鉴 + 知识库资源卡 + 分级对话。
// 任意省/市都能进来：策展城市有精写图文卡，其余城市由后端按名自动兜底（简介+配图+智能体对话）。
export default function CityHub() {
  const { t } = useTranslation();
  const { cityId = '' } = useParams();
  const [sp] = useSearchParams();
  const lang = useStore((s) => s.lang);
  const zh = lang === 'zh';

  const mode: Mode = cityId.startsWith('country_') ? 'country' : cityId.startsWith('place_') ? 'place' : 'city';
  const tz = sp.get('tz');

  const [info, setInfo] = useState<PlaceInfo | null>(null);
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [pedia, setPedia] = useState<CityPedia | null>(null);
  const [localCulture, setLocalCulture] = useState<CultureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<{ title?: string; text?: string; seed?: string } | null>(null);
  const [viewDoc, setViewDoc] = useState<KbDoc | null>(null);
  const [toast, setToast] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoFeature, setGeoFeature] = useState<any>(null);
  const [capital, setCapital] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [capitalName, setCapitalName] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setGeoFeature(null);
    setCapital(null);
    setCapitalName('');
    setPedia(null);
    setLocalCulture([]);
    (async () => {
      try {
        if (mode === 'country') {
          const code = cityId.slice('country_'.length);
          const [cs, kb, world, caps] = await Promise.all([api.countries(), api.kb({ country: code }), api.geo('world'), api.capitals()]);
          if (!alive) return;
          const c = cs.find((x) => x.code === code);
          setInfo({ zh: c?.name_zh || CN_NAME[code] || sp.get('en') || code, en: c?.name_en || sp.get('en') || undefined, flag: code });
          setDocs(kb);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const feat = ((world as any).features as any[])?.find((f) => f?.properties?.ISO_A2 === code) || null;
          setGeoFeature(feat);
          const cp = caps[code];
          const capCity = cp?.cap || '';
          const cLat = c ? c.lat : cp?.lat;
          const cLng = c ? c.lng : cp?.lng;
          if (cLat != null && cLng != null) {
            setCapital({ lat: cLat, lng: cLng, label: `${capCity || c?.name_zh || code} · 首都` });
            setCapitalName(capCity);
          }
        } else if (mode === 'place') {
          const name = decodeURIComponent(cityId.slice('place_'.length));
          if (!alive) return;
          setInfo({ zh: name });
          setDocs([]);
          api.citypedia(name).then((p) => alive && setPedia(p)).catch(() => {});
          api.cultureLocal(name).then((c) => alive && setLocalCulture(c)).catch(() => {});
        } else {
          const cs = await api.cities();
          const c = cs.find((x) => x.id === cityId) || null;
          const kb = c ? await api.kb({ city: c.short_zh }) : [];
          if (!alive) return;
          setInfo(c ? { zh: c.short_zh, en: c.name_en, intro: lang === 'zh' ? c.intro_zh : c.intro_en } : { zh: cityId });
          setDocs(kb);
          api.citypedia(c?.short_zh || cityId).then((p) => alive && setPedia(p)).catch(() => {});
          api.cultureLocal(c?.short_zh || cityId).then((c2) => alive && setLocalCulture(c2)).catch(() => {});
        }
      } catch {
        /* 优雅降级 */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cityId, mode, lang, sp]);

  // 简介：策展城市用图鉴文案，其余用城市自带或兜底
  const intro =
    mode !== 'country' && pedia ? (zh ? pedia.intro_zh : pedia.intro_en) : info?.intro || t('city.placeBuilding');
  const backTo = mode === 'country' ? '/globe' : '/map/china';
  const chatCountry = mode === 'country' ? cityId.slice('country_'.length) : 'CN';
  const placeName = info?.zh || '';
  const topicTags = placeName
    ? [
        { label: '🏞 知名景点', q: `${placeName}有哪些著名景点？请简单介绍。` },
        { label: '🎭 非遗', q: `${placeName}有哪些非物质文化遗产（非遗）？` },
        { label: '🎁 特产', q: `${placeName}有哪些特产或纪念品值得带？` },
        { label: '🍜 美食', q: `推荐几样${placeName}的特色美食。` },
      ]
    : undefined;
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 1800);
  };
  const culture = pedia && (zh ? pedia.culture_zh : pedia.culture_en);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="relative min-h-screen">
      <Hud />
      <BackButton to={backTo} />

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-4">
          {info?.flag && <img src={`https://flagcdn.com/w80/${info.flag.toLowerCase()}.png`} alt={info.flag} className="w-14 h-auto rounded shadow-lg" />}
          <h1 className="text-3xl font-bold text-glow">
            {info?.zh || '…'}
            {info?.en && <span className="text-white/45 text-lg font-normal ml-3">{info.en}</span>}
          </h1>
        </motion.div>
        {mode === 'country' && tz && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs glass rounded-full px-3 py-1">
            🕒 {t('city.timezone')} <span className="text-starcyan">{tz}</span>
          </div>
        )}

        {/* 城市英雄图（AI 生成城市风光；失败降级） */}
        {mode !== 'country' && (
          <div
            className="mt-5 h-44 sm:h-60 rounded-2xl overflow-hidden relative border border-white/10"
            style={{ background: regionColorRgba(info?.zh || '', 0.5) }}
          >
            <CityImg
              kw={cityHeroKw(info?.zh || '')}
              w={1000}
              h={440}
              model="turbo"
              alt={info?.zh}
              className="absolute inset-0 w-full h-full object-cover"
              fallback={<div className="absolute inset-0 grid place-items-center text-6xl opacity-70">🏙️</div>}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-space-900/85 via-space-900/20 to-transparent" />
          </div>
        )}

        <p className="mt-4 text-white/75 max-w-3xl leading-relaxed">{intro}</p>
        {culture && <p className="mt-2 text-sm text-white/55 max-w-3xl leading-relaxed">{culture}</p>}

        {mode === 'country' && geoFeature && (
          <FocusMap
            geojson={geoFeature}
            capital={capital || undefined}
            onCapitalClick={() => setChat({ title: `${capitalName || info?.zh || ''}（首都）` })}
            className="mt-5 h-72 w-full rounded-2xl overflow-hidden border border-white/10"
          />
        )}

        <button onClick={() => setChat({})} className="mt-5 btn-primary px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition">
          🧑‍🏫 {t('chat.title')}
        </button>

        {/* 本地文化主题卡（按省份/城市归属，点开与该城智能体情境对话） */}
        {localCulture.length > 0 && (
          <>
            <h2 className="mt-12 mb-4 text-lg font-semibold text-glow">
              🎎 {zh ? '本地文化' : 'Local Culture'} <span className="text-white/40 text-sm font-normal">{localCulture.length}</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {localCulture.map((it) => {
                const cat = CAT_LABEL[it.category || 'modern'];
                const scenario = (zh ? it.scenario_zh : it.scenario_en) || it.scenario_zh;
                return (
                  <motion.div key={it.id} whileHover={{ y: -4 }} className="glass rounded-2xl p-4 flex flex-col relative overflow-hidden">
                    <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full blur-2xl opacity-25" style={{ background: regionColorRgba(it.title_zh, 0.85) }} />
                    <div className="relative flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{it.emoji}</span>
                        {cat && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/65 whitespace-nowrap">
                            {cat.emoji} {zh ? cat.zh : cat.en}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-semibold text-gold leading-snug">
                        {it.title_zh}
                        <span className="block text-[11px] text-white/45 font-normal">{it.title_en}</span>
                      </h3>
                      <p className="mt-1.5 text-xs text-white/65 flex-1 line-clamp-3">{zh ? it.body_zh : it.body_en}</p>
                      {it.city && it.city !== placeName && <span className="mt-1 text-[10px] text-white/35">📍 {it.city}</span>}
                      {scenario && (
                        <button
                          onClick={() => setChat({ title: it.title_zh, text: scenario, seed: scenario })}
                          className="mt-3 self-start text-xs btn-primary px-3 py-1.5 rounded-lg"
                        >
                          🎭 {zh ? '情境对话' : 'Role-play'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* 热门景点 */}
        {pedia && pedia.attractions.length > 0 && (
          <>
            <h2 className="mt-12 mb-4 text-lg font-semibold text-glow">🏞️ {t('city.attractions')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pedia.attractions.map((it) => (
                <PediaCard key={it.name_zh} item={it} zh={zh} fallback="🏞️" chatLabel={t('city.chat')} onChat={(n) => setChat({ title: n })} />
              ))}
            </div>
          </>
        )}

        {/* 特色美食 */}
        {pedia && pedia.foods.length > 0 && (
          <>
            <h2 className="mt-12 mb-4 text-lg font-semibold text-glow">🍜 {t('city.foods')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pedia.foods.map((it) => (
                <PediaCard key={it.name_zh} item={it} zh={zh} fallback="🍜" chatLabel={t('city.chat')} onChat={(n) => setChat({ title: n })} />
              ))}
            </div>
          </>
        )}

        {/* 自动兜底城市的提示 */}
        {pedia?.auto && (
          <div className="mt-8 glass rounded-2xl px-6 py-6 text-center text-white/55 text-sm">{t('city.autoHint')}</div>
        )}

        {/* 策展知识库资源卡（少数重点城市/国家） */}
        {(docs.length > 0 || loading) && (
          <>
            <h2 className="mt-12 mb-4 text-lg font-semibold text-glow">📚 {t('city.resources')}</h2>
            {loading ? (
              <div className="relative h-40">
                <Loading />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map((d) => (
                  <motion.div key={d.id} whileHover={{ y: -4 }} className="glass rounded-2xl p-5 flex flex-col">
                    <div className="text-2xl mb-2">🏛️</div>
                    <h3 className="font-semibold leading-snug">
                      {d.title}
                      {d.title_en && <span className="block text-xs text-white/45 font-normal mt-0.5">{d.title_en}</span>}
                    </h3>
                    <p className="mt-2 text-xs text-white/55 flex-1 line-clamp-3">{d.body.slice(0, 90)}…</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {d.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-starviolet/15 text-starviolet">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-1.5 text-xs">
                      <button onClick={() => setViewDoc(d)} className="px-2.5 py-1.5 rounded-lg glass hover:border-starcyan/60 transition">
                        {t('city.view')}
                      </button>
                      <button onClick={() => setChat({ title: d.title, text: d.body })} className="px-2.5 py-1.5 rounded-lg btn-primary">
                        💬 {t('city.chat')}
                      </button>
                      <button onClick={() => showToast(t('city.animateSoon'))} className="px-2.5 py-1.5 rounded-lg glass hover:border-starviolet/60 transition" title={t('city.animate')}>
                        🎬
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 资料查看弹层 */}
      <AnimatePresence>
        {viewDoc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewDoc(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-semibold text-glow">{viewDoc.title}</h3>
                <button onClick={() => setViewDoc(null)} className="text-white/60 hover:text-white text-2xl leading-none">
                  ×
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed">{viewDoc.body}</p>
              <button
                onClick={() => {
                  setChat({ title: viewDoc.title, text: viewDoc.body });
                  setViewDoc(null);
                }}
                className="mt-5 btn-primary px-4 py-2 rounded-xl text-sm"
              >
                💬 {t('city.chat')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GradedChat
        open={!!chat}
        onClose={() => setChat(null)}
        contextTitle={chat?.title}
        contextText={chat?.text}
        country={chatCountry}
        topicTags={topicTags}
        seedQuestion={chat?.seed || (chat?.title ? `请用简单的中文介绍「${chat.title}」。` : info?.zh ? `请用简单的中文介绍一下${info.zh}。` : undefined)}
      />
      <Toast text={toast} />
    </motion.div>
  );
}
