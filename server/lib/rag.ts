import { loadKb } from './kb';
import type { KbDoc } from '../../shared/types';

// 极简 RAG（无需向量库）：按「问题字符」与文档的重叠度打分，取 topK 相关片段。
// 中文无需分词，字符重叠对短问答已足够；标题/标签命中加权。
export async function retrieveKb(query: string, topK = 2): Promise<KbDoc[]> {
  const q = (query || '').replace(/[\s，。、！？,.!?；;：:""''（）()【】]/g, '');
  if (q.length < 2) return [];
  const qChars = new Set(q.split(''));
  const all = await loadKb();
  if (!all.length) return [];

  const scored = all.map((d) => {
    const head = `${d.title || ''}${d.title_en || ''}${(d.tags || []).join('')}${d.topic || ''}${d.city || ''}`;
    const full = `${head}${d.body || ''}`;
    let score = 0;
    for (const ch of qChars) {
      if (full.includes(ch)) score += 1;
      if (head.includes(ch)) score += 1.5; // 标题/标签/主题命中加权
    }
    return { d, score };
  });

  const threshold = Math.max(2, qChars.size * 0.4);
  return scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.d);
}
