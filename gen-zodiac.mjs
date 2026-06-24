// 预生成 12 生肖「国潮·文物风」头像为静态图（pollinations 现画→下载打包），根治选择页加载慢。
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ZODIAC = [
  ['rat', '鼠'], ['ox', '牛'], ['tiger', '虎'], ['rabbit', '兔'], ['dragon', '龙'], ['snake', '蛇'],
  ['horse', '马'], ['goat', '羊'], ['monkey', '猴'], ['rooster', '鸡'], ['dog', '狗'], ['pig', '猪'],
];
const OUT = path.resolve('web/public/zodiac');
const BASE = 'https://image.pollinations.ai/prompt/';
function seedOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000000; return h; }
function url(id, zh) {
  const prompt = `Q版可爱${zh}，中国国潮风格，青铜器纹样与朱砂金箔配色，唐三彩与剪纸质感，生肖吉祥物头像特写，居中对称，简洁柔和背景，chibi Chinese guochao zodiac ${id} mascot, bronze ornament texture, auspicious, clean background`;
  return `${BASE}${encodeURIComponent(prompt)}?width=320&height=320&seed=${seedOf(id)}&nologo=true&model=turbo`;
}
async function dl(id, zh) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 35000);
      const r = await fetch(url(id, zh), { signal: ctrl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 2000) throw new Error('too small ' + buf.length);
      await writeFile(path.join(OUT, id + '.jpg'), buf);
      console.log('OK', id, buf.length);
      return true;
    } catch (e) {
      console.log('retry', id, attempt, String(e).slice(0, 50));
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.log('FAIL', id);
  return false;
}
await mkdir(OUT, { recursive: true });
let ok = 0;
// 单并发 + 间隔，避开 pollinations 429 限流；已存在则跳过（可多次运行补齐缺图）
for (const [id, zh] of ZODIAC) {
  if (existsSync(path.join(OUT, id + '.jpg'))) { console.log('skip', id); ok++; continue; }
  if (await dl(id, zh)) ok++;
  await new Promise((r) => setTimeout(r, 4000));
}
console.log('DONE', ok, '/ 12');
