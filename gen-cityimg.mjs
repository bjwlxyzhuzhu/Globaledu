// 预生成城市图鉴静态图（英雄图+景点+美食），根治城市页 pollinations 实时出图慢/429失败/emoji。
// 读 data/citypedia/*.json 收集所有图片关键词 → pollinations turbo 下载到 web/public/cityimg/<安全名>.jpg。
// 并发3 + 重试 + 跳过已存在（幂等，可多次运行补齐缺图）。命名规则与 web/src/lib/cityImage.ts cityImgName 一致。
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('data/citypedia');
const OUT = path.resolve('web/public/cityimg');
const BASE = 'https://image.pollinations.ai/prompt/';

const cityImgName = (kw) => kw.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 80) || 'img';
const heroKw = (name) => `${name} 城市风光 地标 天际线`;
const hashSeed = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000000; return h; };
const urlOf = (kw, w, h) => {
  const prompt = `${kw}，中国，风光摄影，高清写实，photorealistic travel photography`;
  return `${BASE}${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${hashSeed(kw)}&nologo=true&model=turbo`;
};

// 收集全部 {kw, w, h, city}（去重）
const jobs = new Map();
for (const f of await readdir(DIR)) {
  if (!f.endsWith('.json')) continue;
  const j = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
  const add = (kw, w, h) => { if (kw && !jobs.has(kw)) jobs.set(kw, { kw, w, h, city: j.name_zh }); };
  add(heroKw(j.name_zh), 900, 400); // 英雄图
  for (const a of j.attractions || []) add(a.img, 600, 400);
  for (const a of j.foods || []) add(a.img, 600, 400);
}
// 核心演示城市优先生成（限流慢，先把最常演示的城市配齐）
const PRIORITY = ['北京', '上海', '西安', '成都', '南京', '苏州', '杭州', '广州', '深圳', '重庆', '武汉', '天津'];
const pri = (c) => { const i = PRIORITY.indexOf(c); return i < 0 ? 99 : i; };
const all = [...jobs.values()].sort((a, b) => pri(a.city) - pri(b.city));
await mkdir(OUT, { recursive: true });

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function dl({ kw, w, h }) {
  const file = path.join(OUT, cityImgName(kw) + '.jpg');
  if (existsSync(file)) return 'skip';
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 45000);
      const r = await fetch(urlOf(kw, w, h), { signal: ctrl.signal });
      clearTimeout(to);
      if (r.status === 429) throw new Error('429'); // 限流，退避更久
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 2000) throw new Error('too small ' + buf.length);
      await writeFile(file, buf);
      return 'ok';
    } catch (e) {
      if (attempt === 5) { console.log('FAIL', kw, String(e).slice(0, 40)); return 'fail'; }
      const is429 = String(e).includes('429');
      await sleep((is429 ? 8000 : 4000) * attempt); // 429 退避 8/16/24/32s，其它 4/8/12/16s
    }
  }
}

// 串行 + 每张间隔，温柔对待 pollinations 限流（幂等，可多次运行补齐缺图）
let ok = 0, skip = 0, fail = 0;
console.log(`共 ${all.length} 张图片待处理（串行）`);
for (let n = 0; n < all.length; n++) {
  const r = await dl(all[n]);
  if (r === 'ok') ok++; else if (r === 'skip') skip++; else fail++;
  if ((n + 1) % 15 === 0) console.log(`进度 ${n + 1}/${all.length} | 新增${ok} 跳过${skip} 失败${fail}`);
  if (r !== 'skip') await sleep(4000); // 实际请求过才间隔，跳过的不等
}
console.log(`DONE 总计${all.length} | 新增${ok} 跳过${skip} 失败${fail}`);
