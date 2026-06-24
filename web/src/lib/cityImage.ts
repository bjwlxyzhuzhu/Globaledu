// 城市图鉴配图：优先用预生成的静态图（web/public/cityimg/<名>.jpg，秒显、可靠），
// 缺图时由 <CityImg> 退回 pollinations.ai 实时生成，再失败才降级为 emoji。
const BASE = 'https://image.pollinations.ai/prompt/';

// 关键词 → 稳定 seed（同名同图，避免每次刷新换图）
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000000;
  return h;
}

// 关键词 → 安全文件名（去文件系统非法字符、空白转下划线）。预生成脚本与此保持一致。
export function cityImgName(keyword: string): string {
  return keyword.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 80) || 'img';
}

// 城市英雄图统一关键词（CityHub 与预生成脚本必须用同一个，才能命中静态图）
export function cityHeroKw(name: string): string {
  return `${name} 城市风光 地标 天际线`;
}

// 预生成静态图路径（缺图时 <CityImg> 会自动退回 cityImage 实时生成）
export function cityImgPath(keyword: string): string {
  return `/cityimg/${encodeURIComponent(cityImgName(keyword))}.jpg`;
}

// pollinations 实时生成（无 key）。卡片缩略用 turbo（快、抗限流），英雄大图用 flux（质量）。
export function cityImage(keyword: string, opts?: { w?: number; h?: number; model?: 'flux' | 'turbo' }): string {
  const w = opts?.w ?? 640;
  const h = opts?.h ?? 420;
  const model = opts?.model ?? 'turbo';
  const prompt = `${keyword}，中国，风光摄影，高清写实，photorealistic travel photography`;
  const seed = hashSeed(keyword);
  return `${BASE}${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=${model}`;
}
