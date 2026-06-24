import { readJson } from './data';

// ---------- 超纲校验（基于 HSK 词表）----------
type Vocab = { word: string; pinyin: string }[];
const charCache: Record<number, Set<string>> = {};

// 载入 ≤level 的 HSK 允许字集（hsk_vocab 仅 1-3 有种子；缺级时从宽）。
async function allowedChars(level: number): Promise<Set<string>> {
  if (charCache[level]) return charCache[level];
  const set = new Set<string>();
  for (let lv = 1; lv <= Math.min(level, 6); lv++) {
    const v = await readJson<Vocab>(`hsk_vocab/${lv}.json`, []);
    for (const it of v) for (const ch of it.word) set.add(ch);
  }
  charCache[level] = set;
  return set;
}

const PUNCT = /[\s，。、！？,.!?；;：:""''（）()【】…—·0-9a-zA-Z%]/;

/** 超纲检测：回复中不在「≤等级允许字集」、且非标点/数字/字母的字。词表不全时从宽（按比例阈值）。 */
export async function checkVocab(zh: string, level: number): Promise<{ inLevel: boolean; over: string[] }> {
  const set = await allowedChars(level);
  if (set.size < 30) return { inLevel: true, over: [] }; // 词表太少 → 不判超纲
  const content = [...zh].filter((c) => !PUNCT.test(c));
  const over = new Set<string>();
  for (const ch of content) if (!set.has(ch)) over.add(ch);
  const arr = [...over];
  // 容忍专有名词/地名等：超纲字超过内容字的 30%（且 >3 个）才判超纲
  const inLevel = arr.length <= Math.max(3, Math.floor(content.length * 0.3));
  return { inLevel, over: arr.slice(0, 8) };
}

// ---------- 文化禁忌（按国家）----------
type Taboo = { country: string; topic: string; note: string }[];

/** 取该国相关的文化禁忌指导（含通用 *），注入 system 让助教主动尊重。 */
export async function tabooGuidance(country: string): Promise<string[]> {
  const all = await readJson<Taboo>('taboo.json', []);
  const c = (country || '').toUpperCase();
  return all.filter((t) => t.country === '*' || t.country.toUpperCase() === c).map((t) => `【${t.topic}】${t.note}`);
}

// 轻量违禁检测：对穆斯林为主的国家用户，回复推荐猪肉/酒精类 → 触发标记。
const SENSITIVE: Record<string, RegExp> = {
  ID: /猪肉|火腿|培根|酒精|啤酒|白酒|红酒|葡萄酒/,
  PK: /猪肉|火腿|培根|酒精|啤酒|白酒|红酒|葡萄酒/,
  MY: /猪肉|火腿|培根|酒精|啤酒|白酒|红酒|葡萄酒/,
};
export function checkTaboo(zh: string, country: string): boolean {
  const re = SENSITIVE[(country || '').toUpperCase()];
  return re ? re.test(zh) : false;
}
