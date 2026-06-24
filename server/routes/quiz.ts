import { Router } from 'express';
import { chatJSON } from '../llm/deepseek';
import { retrieveKb } from '../lib/rag';
import { readJson } from '../lib/data';
import type { CityPedia, QuizQuestion, CultureItem } from '../../shared/types';

const router = Router();

// 去城市名后缀（与 kb.ts 一致）
function normalizeCity(raw: string): string {
  return raw.replace(/(特别行政区|自治州|自治县|地区|盟|旗|市|区|县|省)$/u, '') || raw;
}

// POST /api/quiz/generate —— 中文语言导师：按某城市/主题的知识库 + 目标 HSK 等级，AI 现场出分级题
router.post('/quiz/generate', async (req, res) => {
  const { topic = '', hskLevel = 3, count = 5, nativeLang = 'English', model } = (req.body || {}) as {
    topic?: string;
    hskLevel?: number;
    count?: number;
    nativeLang?: string;
    model?: string;
  };
  const level = Math.min(6, Math.max(1, Number(hskLevel) || 3));
  const n = Math.min(8, Math.max(3, Number(count) || 5));
  const key = normalizeCity(topic);

  // 1) 聚合知识库上下文：策展城市图鉴（景点/美食/文化）+ RAG 命中的文化卡/知识库
  const ctx: string[] = [];
  const sources: string[] = [];
  const pedia =
    (await readJson<CityPedia | null>(`citypedia/${topic}.json`, null)) ||
    (await readJson<CityPedia | null>(`citypedia/${key}.json`, null));
  if (pedia && !pedia.auto) {
    sources.push(pedia.name_zh);
    ctx.push(`${pedia.name_zh}：${pedia.intro_zh || ''} ${pedia.culture_zh || ''}`.trim());
    for (const a of (pedia.attractions || []).slice(0, 4)) ctx.push(`景点·${a.name_zh}：${a.desc_zh || ''}`);
    for (const f of (pedia.foods || []).slice(0, 4)) ctx.push(`美食·${f.name_zh}：${f.desc_zh || ''}`);
  }
  const ragDocs = await retrieveKb(topic, 3);
  for (const d of ragDocs) {
    sources.push(d.title);
    ctx.push(`${d.title}：${(d.body || '').replace(/\s+/g, ' ').slice(0, 240)}`);
  }
  // 文化卡（AI 已打 hskRange/refs 标签）：挑与 topic 相关、且 HSK 难度适配本级的卡，丰富出题素材（交叉引用）
  const cards = await readJson<CultureItem[]>('learn/culture.json', []);
  const matched = cards
    .filter((c) => {
      const hay = `${c.title_zh} ${(c.refs || []).join('')} ${c.city || ''}${c.province || ''}`;
      const topicMatch = hay.includes(key) || hay.includes(topic);
      const levelFit = !c.hskRange || (c.hskRange[0] <= level && level <= c.hskRange[1]);
      return topicMatch && levelFit;
    })
    .slice(0, 3);
  for (const c of matched) {
    sources.push(c.title_zh);
    ctx.push(`${c.title_zh}：${(c.body_zh || '').slice(0, 200)}`);
  }
  const context = ctx.filter(Boolean).join('\n').slice(0, 2000) || `${topic} 是中国的一个文化主题。`;

  // 2) 让「中文语言导师」按 HSK 等级出题（严格 JSON）
  const system = `你是「中文语言导师」，为来华留学生出 HSK 分级中文练习题。
规则：
1. 严格按 HSK${level} 难度：用词和语法控制在 HSK${level} 及以下，题干简洁明了。
2. 题目内容必须与「${topic}」相关，依据下面的【知识库事实】，不要编造事实。
3. 出 ${n} 道四选一选择题，题型可混合：词汇、语法填空、内容理解（围绕该地的文化/景点/美食）。
4. 每题给中文解析，母语解析用 ${nativeLang}。
5. 只输出 JSON：{"questions":[{"stem_zh":"题干（可含 ____ ）","stem_en":"英文翻译","options":["A","B","C","D"],"answer":0,"explain_zh":"解析","explain_en":"explanation"}]}，answer 为正确项下标(0-3)。

【知识库事实】
${context}`;

  const ai = await chatJSON<{ questions: QuizQuestion[] }>({
    system,
    user: `请出 ${n} 道关于「${topic}」的 HSK${level} 级中文题。`,
    model,
  });

  let questions = (ai?.questions || [])
    .filter((q) => q && q.stem_zh && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === 'number')
    .map((q) => ({ ...q, answer: Math.max(0, Math.min(q.options.length - 1, q.answer)) }))
    .slice(0, n);
  let mock = false;

  if (!questions.length) {
    mock = true;
    questions = [
      {
        stem_zh: `「${topic}」最有名的是什么方面？`,
        stem_en: `What is ${topic} most famous for?`,
        options: ['它的文化和特色', '完全没有名气', '只有高楼', '无法回答'],
        answer: 0,
        explain_zh: '（演示）连接大模型后，会按该地知识库与你选的 HSK 等级生成真实分级题。',
        explain_en: '(Demo) Connect the AI model to get real, KB-based HSK-graded questions for this place.',
      },
    ];
  }

  res.json({ topic, hskLevel: level, questions, sources: [...new Set(sources)].slice(0, 5), mock });
});

export default router;
