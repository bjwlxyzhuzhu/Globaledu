import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chatJSON, AVAILABLE_MODELS, getModel } from '../llm/deepseek';
import { retrieveKb } from '../lib/rag';
import { checkVocab, tabooGuidance, checkTaboo } from '../lib/grading';
import { getDb } from '../db/index';
import type { ChatRequest, ChatReply, LevelCheck, ReplyItem } from '../../shared/types';

const router = Router();

// 分级·反谄媚 system prompt 模板（首次读取后缓存）
let promptTpl = '';
async function getPrompt(): Promise<string> {
  if (!promptTpl) {
    promptTpl = await readFile(path.resolve(import.meta.dirname, '../prompts/graded_chat.md'), 'utf-8');
  }
  return promptTpl;
}

const LANG_NAMES: Record<string, string> = {
  zh: '中文',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  ru: 'Русский',
  ar: 'العربية',
  de: 'Deutsch',
};

// 无 key 兜底：各语言的占位回复
const DEMO: Record<string, (u: string, h: number) => string> = {
  zh: (u, h) => `（演示模式）你好！我看到你说："${u || '……'}"。现在还没有连接大模型，这是占位回复。我会按 HSK ${h} 级，用简单的中文和你交流。`,
  en: (u, h) => `(Demo mode) Hi! I received: "${u || '...'}". The AI model isn't connected yet, so this is a placeholder. Add a DeepSeek key for real HSK ${h}-level graded replies.`,
  fr: () => `(Mode démo) Bonjour ! Le modèle d'IA n'est pas encore connecté ; ceci est une réponse de remplacement.`,
  es: () => `(Modo demo) ¡Hola! El modelo de IA aún no está conectado; esta es una respuesta de marcador de posición.`,
  ru: () => `(Демо-режим) Привет! Модель ИИ ещё не подключена; это временный ответ.`,
  ar: () => `(الوضع التجريبي) مرحبًا! نموذج الذكاء الاصطناعي غير متصل بعد؛ هذه رسالة مؤقتة.`,
  de: () => `(Demomodus) Hallo! Das KI-Modell ist noch nicht verbunden; dies ist ein Platzhalter.`,
};

// 近似句长上限（按字符，仅用于展示「分级是否生效」的指标）
function maxSentenceLen(zh: string): number {
  const sentences = zh.split(/[。！？；\n]/).map((s) => s.trim()).filter(Boolean);
  let max = 0;
  for (const s of sentences) {
    const len = s.replace(/[，、,:：]/g, '').length;
    if (len > max) max = len;
  }
  return max;
}

function detectSycophancy(zh: string): boolean {
  return /(你真棒|太棒了|完全正确|非常完美|你太厉害|棒极了)/.test(zh);
}

// POST /api/chat —— 分级反谄媚 · 多语言对话（PRD §6）
router.post('/chat', async (req, res) => {
  const body = (req.body || {}) as ChatRequest;
  const hsk = body.hskLevel || 3;
  const country = body.country || '';
  const langs = body.outputLangs && body.outputLangs.length ? body.outputLangs : ['zh', 'en'];
  const nativeLang = langs.filter((l) => l !== 'zh').map((l) => LANG_NAMES[l] || l).join(' / ') || 'English';
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user')?.content || '';
  const history = msgs
    .filter((m) => m.role !== 'system')
    .slice(-9, -1)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const tpl = await getPrompt();
  const langList = langs.map((l) => `${l}(${LANG_NAMES[l] || l})`).join(', ');
  const baseSystem = tpl
    .replaceAll('{{hskLevel}}', String(hsk))
    .replaceAll('{{nativeLang}}', nativeLang)
    .replaceAll('{{country}}', country || '未知')
    .replaceAll('{{langs}}', langList);

  // M5：注入文化禁忌指导 + RAG 知识库检索（据资料作答、勿编造）
  const taboos = await tabooGuidance(country);
  const ragDocs = await retrieveKb(lastUser, 2);
  const ragTitles = ragDocs.map((d) => d.title);
  let system = baseSystem;
  if (taboos.length) system += `\n\n【文化注意（回答时请尊重，勿冒犯）】\n- ${taboos.join('\n- ')}`;
  if (ragDocs.length)
    system += `\n\n【知识库参考资料（优先据此作答，不要编造）】\n${ragDocs
      .map((d) => `· ${d.title}：${(d.body || '').replace(/\s+/g, ' ').slice(0, 280)}`)
      .join('\n')}`;

  // 双师：语言导师角色——侧重把中文本身教好（纠错、讲语法词汇、给分级练习）
  if (body.role === 'language')
    system += `\n\n【你的角色：中文语言导师】你不只是回答内容，更要帮学生学好中文本身：① 如果学生的中文有错误或不地道，先指出错在哪、给出正确说法；② 讲解相关的高频词汇和语法点（控制在 HSK${hsk} 及以下）；③ 给一两个 HSK${hsk} 难度的例句或小练习。语气鼓励，多引导学生用中文表达。`;

  const ai = await chatJSON<{ replies: ReplyItem[]; notes?: string[] }>({ system, user: lastUser, history, model: body.model });

  let replies: ReplyItem[];
  let suggestions: string[];
  let mock = false;

  if (ai && Array.isArray(ai.replies) && ai.replies.length) {
    replies = ai.replies.filter((r) => r && r.lang && r.text);
  } else {
    mock = true;
    replies = langs.map((l) => ({ lang: l, text: (DEMO[l] || DEMO.en)(lastUser, hsk) }));
  }
  suggestions = ai?.notes || (mock ? ['在 .env 填入 DEEPSEEK_API_KEY 后即可获得真实的分级·反谄媚多语回复。'] : []);

  const zhText = replies.find((r) => r.lang === 'zh')?.text || replies[0]?.text || '';
  const vc = await checkVocab(zhText, hsk);
  const level_check: LevelCheck = {
    vocab_in_level: vc.inLevel,
    over_words: vc.over,
    max_sentence_len: maxSentenceLen(zhText),
    sycophancy_flag: detectSycophancy(zhText),
    taboo_flag: checkTaboo(zhText, country),
  };

  const reply: ChatReply = { replies, level_check, suggestions, mock, rag_titles: ragTitles };

  // M5：学习指标入库（懒加载 SQLite；失败不影响对话）
  void (async () => {
    try {
      const db = await getDb();
      const stmt = db.prepare(
        'INSERT INTO learning_records (id, user_id, module, item_id, score, metrics_json, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ) as { run: (...a: unknown[]) => unknown };
      stmt.run(
        randomUUID(),
        body.sessionId || 'anon',
        'chat',
        '',
        level_check.vocab_in_level ? 1 : 0,
        JSON.stringify({ ...level_check, hsk, country, model: body.model || 'default', mock, rag: ragTitles.length }),
        Date.now(),
      );
    } catch {
      /* 入库失败忽略 */
    }
  })();

  res.json(reply);
});

// GET /api/metrics —— 学情聚合（M5；M7 教师看板用）
router.get('/metrics', async (_req, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT metrics_json, ts FROM learning_records WHERE module = ? ORDER BY ts DESC LIMIT 200') as {
      all: (...a: unknown[]) => { metrics_json: string; ts: number }[];
    };
    const rows = stmt.all('chat');
    const items: (Record<string, unknown> & { ts: number })[] = rows.map((r) => ({ ...(JSON.parse(r.metrics_json) as Record<string, unknown>), ts: r.ts }));
    const n = items.length;
    const rate = (f: (x: Record<string, unknown>) => boolean) => (n ? Math.round((items.filter(f).length / n) * 100) : 0);
    res.json({
      count: n,
      vocab_in_level_rate: rate((x) => !!x.vocab_in_level),
      sycophancy_rate: rate((x) => !!x.sycophancy_flag),
      taboo_rate: rate((x) => !!x.taboo_flag),
      avg_sentence_len: n ? Math.round(items.reduce((s, x) => s + (Number(x.max_sentence_len) || 0), 0) / n) : 0,
      recent: items.slice(0, 20),
    });
  } catch {
    res.json({ count: 0, recent: [] });
  }
});

// GET /api/models —— 对话框可选的大模型清单 + 当前默认（.env 的 LLM_MODEL）
router.get('/models', (_req, res) => {
  res.json({ models: AVAILABLE_MODELS, default: getModel() });
});

export default router;
