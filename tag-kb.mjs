// 知识库 AI 自动打标签：给文化卡加 hskRange+refs，给 citypedia 景点/美食加 category+hskRange+refs。
// 直连 .env 的大模型，分批、幂等（已标跳过，可多次运行补齐）。运行：node tag-kb.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

try { process.loadEnvFile('.env'); } catch { /* 无 .env 也继续（走启发式兜底） */ }
const KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.LLM_MODEL || 'deepseek-v4-pro';
const CATS = 'heritage(文物古迹) intangible(非遗技艺) festival(节日节气) food(饮食茶酒) folklore(民俗风情) art(传统艺术) thought(思想哲学) modern(当代中国)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function llmJson(system, user, tries = 3) {
  if (!KEY) return null;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      let txt = (j.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
      const s = txt.indexOf('{'); const e = txt.lastIndexOf('}');
      if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
      return JSON.parse(txt);
    } catch {
      await sleep(2500 * (i + 1));
    }
  }
  return null;
}

const clampRange = (r) => {
  if (!Array.isArray(r) || r.length < 2) return [1, 6];
  let [a, b] = [Math.round(+r[0] || 1), Math.round(+r[1] || 6)];
  a = Math.min(6, Math.max(1, a)); b = Math.min(6, Math.max(1, b));
  return a <= b ? [a, b] : [b, a];
};
const cleanRefs = (x) => (Array.isArray(x) ? x : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5);

// ========== 1) 文化卡：hskRange + refs ==========
async function tagCulture() {
  const FILE = new URL('./data/learn/culture.json', import.meta.url);
  const arr = JSON.parse(await readFile(FILE, 'utf8'));
  const todo = arr.filter((x) => !x.hskRange);
  if (!todo.length) { console.log('文化卡：全部已标签'); return; }
  const sys = `你是中文教育知识库标注助手。给每张文化卡打两个标签：
- hskRange：用这张卡的内容出中文题，合理的 HSK 难度范围 [最低,最高]（1-6 的整数，概念越大众越靠 HSK1-2，越专业/抽象越靠 HSK5-6）。
- refs：3-5 个中文交叉引用关键词（人物/朝代/地点/相关主题），便于和其它内容关联。
只输出 JSON：{"items":[{"id":"原id","hskRange":[2,5],"refs":["关键词1","关键词2"]}]}`;
  let done = 0;
  for (let i = 0; i < todo.length; i += 15) {
    const batch = todo.slice(i, i + 15);
    const user = '给这些文化卡打标签：\n' + batch.map((x) => `${x.id}｜${x.title_zh}：${(x.body_zh || '').slice(0, 60)}`).join('\n');
    const res = await llmJson(sys, user);
    const map = new Map((res?.items || []).map((r) => [r.id, r]));
    for (const x of batch) {
      const r = map.get(x.id);
      x.hskRange = clampRange(r?.hskRange);
      x.refs = cleanRefs(r?.refs);
      done++;
    }
    await writeFile(FILE, JSON.stringify(arr, null, 2) + '\n', 'utf8'); // 每批落盘（被杀也保留进度）
    console.log(`文化卡 ${Math.min(i + 15, todo.length)}/${todo.length}`);
    await sleep(1500);
  }
  console.log('文化卡完成：', done);
}

// ========== 2) citypedia 景点/美食：category + hskRange + refs ==========
async function tagCitypedia() {
  const DIR = path.resolve('data/citypedia');
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
  const sys = `你是中文教育知识库标注助手。给城市的景点/美食条目打标签：
- category：从这 8 类选一个最贴切的（只填英文 key）：${CATS}
- hskRange：用它出中文题的合理 HSK 难度 [最低,最高]（1-6 整数）。
- refs：2-4 个中文交叉引用关键词。
只输出 JSON：{"items":[{"name":"原name_zh","category":"food","hskRange":[2,4],"refs":["..."]}]}`;
  let cityDone = 0;
  for (const f of files) {
    const fp = path.join(DIR, f);
    const j = JSON.parse(await readFile(fp, 'utf8'));
    const items = [...(j.attractions || []), ...(j.foods || [])];
    const todo = items.filter((it) => !it.hskRange);
    if (!todo.length) continue;
    const user = `城市「${j.name_zh}」，给这些条目打标签：\n` + todo.map((it) => `${it.name_zh}：${(it.desc_zh || '').slice(0, 50)}`).join('\n');
    const res = await llmJson(sys, user);
    const map = new Map((res?.items || []).map((r) => [r.name, r]));
    for (const it of todo) {
      const r = map.get(it.name_zh);
      it.category = (r?.category || '').replace(/[（(].*$/, '').trim() || undefined;
      it.hskRange = clampRange(r?.hskRange);
      it.refs = cleanRefs(r?.refs);
    }
    await writeFile(fp, JSON.stringify(j, null, 2) + '\n', 'utf8');
    cityDone++;
    if (cityDone % 5 === 0) console.log(`citypedia ${cityDone}/${files.length} 城`);
    await sleep(1200);
  }
  console.log('citypedia 完成：', cityDone, '城');
}

console.log(KEY ? `用模型 ${MODEL} 打标签…` : '⚠ 无 KEY，跳过（需 .env 的 DEEPSEEK_API_KEY）');
await tagCulture();
await tagCitypedia();
console.log('DONE');
