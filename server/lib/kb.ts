import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './data';
import type { KbDoc } from '../../shared/types';

const KB_DIR = path.join(DATA_DIR, 'kb_seed');

// 极简 YAML frontmatter 解析：--- 之间的 key: value（支持 [a, b] 数组）。
function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string | string[]> = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      meta[key] = val;
    }
  }
  return { meta, body: m[2].trim() };
}

// 读取全部知识库文档（不缓存：学生改 data 后无需重启即生效）
export async function loadKb(): Promise<KbDoc[]> {
  try {
    const files = (await readdir(KB_DIR)).filter((f) => f.endsWith('.md'));
    const docs: KbDoc[] = [];
    for (const f of files) {
      const raw = await readFile(path.join(KB_DIR, f), 'utf-8');
      const { meta, body } = parseFrontmatter(raw);
      const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(',') : v);
      docs.push({
        id: str(meta.id) || f.replace(/\.md$/, ''),
        title: str(meta.title) || str(meta.id) || f,
        title_en: str(meta.title_en),
        body,
        lang: 'zh',
        country: str(meta.country),
        city: str(meta.city),
        topic: str(meta.topic),
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        source: str(meta.source),
      });
    }
    return docs;
  } catch (e) {
    console.warn('[kb] 加载失败', (e as Error).message);
    return [];
  }
}

// 规范化中文地名（去 市/省/区/县 后缀），便于宽松匹配
function norm(s?: string): string {
  return (s || '').replace(/[市省区县]/g, '').trim();
}

export async function queryKb(opts: {
  city?: string;
  country?: string;
  topic?: string;
}): Promise<KbDoc[]> {
  const all = await loadKb();
  return all.filter((d) => {
    if (opts.city && norm(d.city) !== norm(opts.city)) return false;
    if (opts.country && (d.country || '').toUpperCase() !== opts.country.toUpperCase()) return false;
    if (opts.topic && d.topic !== opts.topic) return false;
    return true;
  });
}
