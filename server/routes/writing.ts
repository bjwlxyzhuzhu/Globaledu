import { Router } from 'express';
import { aiRateLimit } from '../lib/ratelimit';
import { randomUUID } from 'node:crypto';
import { chatJSON } from '../llm/deepseek';
import { getDb } from '../db/index';
import { currentUser, requireAuth, type TokenPayload } from '../lib/auth';
import type { WritingGrade } from '../../shared/types';

// POST /api/writing/grade —— 中文语言导师：按 HSK 等级批改学生作文（四维评分 + 逐条纠错 + 总评）。
const router = Router();

type Stmt = { all: (...a: unknown[]) => Record<string, unknown>[]; run: (...a: unknown[]) => unknown };

// 仅统计中文字符数（用于 mock 兜底的长度评估）
function zhLen(s: string): number {
  return (s.match(/[一-鿿]/g) || []).length;
}

router.post('/writing/grade', aiRateLimit, async (req, res) => {
  const {
    text = '',
    hskLevel = 3,
    prompt = '',
    nativeLang = 'English',
    minChars = 0,
    itemId = '',
    title = '',
    model,
  } = (req.body || {}) as {
    text?: string;
    hskLevel?: number;
    prompt?: string;
    nativeLang?: string;
    minChars?: number;
    itemId?: string;
    title?: string;
    model?: string;
  };
  const level = Math.min(6, Math.max(1, Number(hskLevel) || 3));
  const essay = String(text || '').trim();
  if (!essay) {
    res.status(400).json({ error: '请先写一段文字再提交批改' });
    return;
  }

  const system = `你是一位经验丰富、鼓励为主的对外汉语「写作批改老师」，正在批改来华留学生的作文。
评分标准：以 HSK${level} 水平的学生为参照，难度越低越宽松、越鼓励。
请从四个维度各打 0~100 分：content（内容是否切题、充实）、grammar（语法是否正确）、vocab（词汇是否丰富恰当）、coherence（结构是否连贯）。
综合分 score 取四维加权（内容30%、语法30%、词汇20%、连贯20%）四舍五入。
找出最多 4 处典型错误或可改进之处，每处给：original（原句/原词）、fixed（修改后）、note_zh（中文说明为什么）、note_en（用 ${nativeLang} 说明）。若几乎没有错误，corrections 可为空数组。
comment_zh 给一段中文总评（先肯定优点，再给 1~2 条具体建议，语气温暖鼓励，控制在 HSK${level} 学生能看懂的难度）；comment_native 用 ${nativeLang} 给同样意思的总评。
只输出 JSON：{"score":0,"dims":{"content":0,"grammar":0,"vocab":0,"coherence":0},"corrections":[{"original":"","fixed":"","note_zh":"","note_en":""}],"comment_zh":"","comment_native":""}

【作文题目】${prompt}
【学生作文】
${essay.slice(0, 1500)}`;

  const ai = await chatJSON<WritingGrade>({ system, user: '请批改这篇作文并按要求输出 JSON。', model });

  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  let grade: WritingGrade;
  if (ai && ai.dims && typeof ai.comment_zh === 'string' && ai.comment_zh) {
    grade = {
      score: clamp(ai.score),
      dims: {
        content: clamp(ai.dims.content),
        grammar: clamp(ai.dims.grammar),
        vocab: clamp(ai.dims.vocab),
        coherence: clamp(ai.dims.coherence),
      },
      corrections: Array.isArray(ai.corrections)
        ? ai.corrections
            .filter((c) => c && (c.original || c.fixed))
            .slice(0, 4)
            .map((c) => ({
              original: String(c.original || ''),
              fixed: String(c.fixed || ''),
              note_zh: String(c.note_zh || ''),
              note_en: String(c.note_en || ''),
            }))
        : [],
      comment_zh: ai.comment_zh,
      comment_native: ai.comment_native || ai.comment_zh,
      mock: false,
    };
  } else {
    // 无 key / 模型限流：按字数给启发式评分 + 鼓励性总评（演示线不中断）
    const len = zhLen(essay);
    const target = Math.max(15, Number(minChars) || level * 30);
    const lenScore = Math.min(100, Math.round((len / target) * 80) + 20);
    const base = Math.max(60, Math.min(92, lenScore));
    grade = {
      score: base,
      dims: { content: base, grammar: base - 3, vocab: base - 5, coherence: base - 2 },
      corrections: [],
      comment_zh: `（演示批改）你写了 ${len} 个字，${len >= target ? '达到了建议字数，很棒！' : '可以再多写一点，把内容写得更充实。'}连接大模型后，老师会逐句给出语法、词汇的具体批改和修改建议。继续加油！`,
      comment_native: `(Demo) You wrote ${len} Chinese characters. Connect the AI model to get detailed, sentence-level corrections and suggestions. Keep going!`,
      mock: true,
    };
  }

  // 已登录则保存这次写作原文 + 批改结果（学生看历史、老师看学情）。失败不影响返回。
  const authed = currentUser(req);
  if (authed) {
    void (async () => {
      try {
        const db = await getDb();
        (db.prepare(
          'INSERT INTO writings (id, user_id, item_id, title, prompt, text, score, dims_json, corrections_json, comment_zh, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ) as Stmt).run(
          randomUUID(),
          authed.uid,
          itemId,
          title,
          prompt,
          essay,
          grade.score,
          JSON.stringify(grade.dims),
          JSON.stringify(grade.corrections),
          grade.comment_zh,
          Date.now(),
        );
      } catch {
        /* 入库失败忽略 */
      }
    })();
  }

  res.json(grade);
});

// GET /api/writing/history —— 当前学生的写作记录（含原文 + 批改）
router.get('/writing/history', requireAuth, async (req, res) => {
  const uid = (req as unknown as { user: TokenPayload }).user.uid;
  try {
    const db = await getDb();
    const rows = (db.prepare(
      'SELECT id, item_id, title, prompt, text, score, dims_json, corrections_json, comment_zh, ts FROM writings WHERE user_id = ? ORDER BY ts DESC LIMIT 50',
    ) as Stmt).all(uid);
    res.json({ writings: rows.map(shapeWriting) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 把一行 writings 还原成前端友好结构（解析 JSON 列）
export function shapeWriting(r: Record<string, unknown>) {
  const parse = <T,>(s: unknown, fb: T): T => {
    try {
      return JSON.parse(String(s || '')) as T;
    } catch {
      return fb;
    }
  };
  return {
    id: r.id,
    item_id: r.item_id,
    title: r.title,
    prompt: r.prompt,
    text: r.text,
    score: r.score ?? 0,
    dims: parse(r.dims_json, { content: 0, grammar: 0, vocab: 0, coherence: 0 }),
    corrections: parse(r.corrections_json, [] as unknown[]),
    comment_zh: r.comment_zh || '',
    ts: r.ts,
  };
}

export default router;
