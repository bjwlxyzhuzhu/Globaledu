import { Router } from 'express';
import { queryKb } from '../lib/kb';
import { readJson } from '../lib/data';
import type { City, Province, HanziItem, CityPedia, CultureItem } from '../../shared/types';

const router = Router();

// GET /api/kb?country=&city=&topic= —— 知识库检索（PRD §13；M5 起加 RAG topK）
router.get('/kb', async (req, res) => {
  const { city, country, topic } = req.query as Record<string, string | undefined>;
  const docs = await queryKb({ city, country, topic });
  res.json(docs);
});

// GET /api/cities?province= —— 城市元数据
router.get('/cities', async (req, res) => {
  const cities = await readJson<City[]>('cities.json', []);
  const { province } = req.query as Record<string, string | undefined>;
  res.json(province ? cities.filter((c) => c.province === province) : cities);
});

// GET /api/provinces —— 省份元数据（含直辖市标记）
router.get('/provinces', async (_req, res) => {
  res.json(await readJson<Province[]>('provinces.json', []));
});

// GET /api/citylist —— 全国城市目录（[{name,province}]，370 城），供「城市检索」页搜索跳转
router.get('/citylist', async (_req, res) => {
  res.json(await readJson<{ name: string; province: string }[]>('citylist.json', []));
});

// GET /api/capitals —— 各国首都（code → {lat,lng,cap}）
router.get('/capitals', async (_req, res) => {
  res.json(await readJson<Record<string, { lat: number; lng: number; cap: string }>>('capitals.json', {}));
});

// GET /api/hanzi —— 汉字闯关字库（PRD §13）
router.get('/hanzi', async (_req, res) => {
  res.json(await readJson<HanziItem[]>('hanzi.json', []));
});

// GET /api/learn/:module —— 学习模块数据（听力/口语/阅读/写作/HSK/HSKK/文化），读 data/learn/<module>.json
const LEARN_MODULES = ['listening', 'speaking', 'reading', 'writing', 'hsk', 'hskk', 'culture'];
router.get('/learn/:module', async (req, res) => {
  const { module } = req.params;
  if (!LEARN_MODULES.includes(module)) return res.status(404).json([]);
  res.json(await readJson<unknown[]>(`learn/${module}.json`, []));
});

// GET /api/citypedia/:city —— 城市文化/景点/美食图鉴；策展优先，否则按城市名自动兜底（任意二三线城市点开即可用）
function normalizeCity(raw: string): string {
  return raw.replace(/(特别行政区|自治州|自治县|地区|盟|旗|市|区|县|省)$/u, '') || raw;
}

// GET /api/culture/local/:place —— 该省/市的本地文化卡，让文化内容归属省份与城市。
// 传城市名：返回本市卡（在前）+ 本省其它城市卡；传省份名：返回全省各市卡。
router.get('/culture/local/:place', async (req, res) => {
  const key = normalizeCity(decodeURIComponent(req.params.place));
  const all = await readJson<CultureItem[]>('learn/culture.json', []);
  const nc = (s?: string) => (s ? normalizeCity(s) : '');
  const cityHit = all.filter((it) => nc(it.city) === key);
  const provHit = all.filter((it) => nc(it.province) === key);
  const prov = cityHit[0]?.province ? nc(cityHit[0].province) : '';
  if (prov && prov !== key) {
    const sameProv = all.filter((it) => nc(it.province) === prov && nc(it.city) !== key);
    return res.json([...cityHit, ...sameProv]); // 本市在前，本省其它城市在后
  }
  res.json(provHit.length ? provHit : cityHit);
});
router.get('/citypedia/:city', async (req, res) => {
  const raw = decodeURIComponent(req.params.city);
  const key = normalizeCity(raw);
  const curated =
    (await readJson<CityPedia | null>(`citypedia/${raw}.json`, null)) ||
    (await readJson<CityPedia | null>(`citypedia/${key}.json`, null));
  if (curated) return res.json(curated);
  const stub: CityPedia = {
    key,
    name_zh: key,
    name_en: '',
    intro_zh: `${key}是中国的一座城市。点开和当地智能体聊聊它的文化、景点与美食吧！`,
    intro_en: `${key} is a city in China. Chat with the local agent about its culture, sights and food!`,
    attractions: [],
    foods: [],
    auto: true,
  };
  res.json(stub);
});

export default router;
