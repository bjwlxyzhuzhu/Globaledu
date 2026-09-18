import { Router } from 'express';
import { aiRateLimit } from '../lib/ratelimit';
import { chatJSON, hasLLM } from '../llm/deepseek';

// M6：Studio 智能体集群产出。SSE 流式推送「智能体协作 trace」+ 最终双语结构化幻灯内容。
const router = Router();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Slide {
  heading_zh: string;
  heading_en: string;
  points_zh: string[];
  points_en: string[];
}
interface StudioDoc {
  title_zh: string;
  title_en: string;
  slides: Slide[];
  summary_zh: string;
  summary_en: string;
}

const TASK_LABEL: Record<string, string> = {
  doc: '图文文档',
  report: '学习报告',
  poster: '海报文案',
  speech: '演讲稿',
  lesson: '微课提纲',
};

function mockDoc(taskType: string, topic: string): StudioDoc {
  const t = topic || '中国文化';
  return {
    title_zh: `${t} · ${TASK_LABEL[taskType] || '产出'}`,
    title_en: `${t} — ${taskType}`,
    slides: [
      { heading_zh: '引言', heading_en: 'Introduction', points_zh: [`关于「${t}」的简要介绍`, '为什么值得了解', '本篇要点预览'], points_en: [`A brief intro to "${t}"`, 'Why it matters', 'What we will cover'] },
      { heading_zh: '要点一', heading_en: 'Point One', points_zh: ['核心概念', '生活中的例子', '实用小贴士'], points_en: ['The key idea', 'A real-life example', 'A handy tip'] },
      { heading_zh: '要点二', heading_en: 'Point Two', points_zh: ['延伸知识', '常见误区', '练习建议'], points_en: ['Going deeper', 'Common mistakes', 'Practice tips'] },
      { heading_zh: '总结', heading_en: 'Summary', points_zh: ['回顾要点', '行动建议', '继续学习'], points_en: ['Recap the points', 'Next actions', 'Keep learning'] },
    ],
    summary_zh: `（演示模式）这是关于「${t}」的占位产出，配置大模型 key 后可生成真实内容。`,
    summary_en: `(Demo mode) Placeholder output about "${t}". Add an LLM key for real content.`,
  };
}

router.post('/studio/generate', aiRateLimit, async (req, res) => {
  const { taskType = 'doc', topic = '', hskLevel = 3 } = (req.body || {}) as { taskType?: string; topic?: string; hskLevel?: number };
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // 智能体集群（每个 agent 负责一环，流式推送 trace）
  const crew = [
    { agent: '🧭 需求分析师', step: '理解任务与受众' },
    { agent: '🔎 资料研究员', step: '检索相关知识' },
    { agent: '🏗 大纲架构师', step: '搭建内容大纲' },
    { agent: '✍ 内容写作员', step: '生成分页要点' },
    { agent: '🌏 双语润色师', step: '中英双语对照润色' },
    { agent: '🎨 排版设计师', step: '排版成稿' },
  ];
  try {
    for (let i = 0; i < crew.length; i++) {
      send('trace', { ...crew[i], i, total: crew.length });
      await sleep(450);
    }
    let doc: StudioDoc | null = null;
    if (hasLLM()) {
      const system = `你是中文教学内容创作智能体集群的总编。面向 HSK${hskLevel} 的来华留学生，根据任务类型与主题产出适合做成幻灯片的结构化内容。中文须控制在 HSK${hskLevel} 词汇与短句，英文对照地道。`;
      const user = `任务类型：${TASK_LABEL[taskType] || taskType}；主题：${topic || '中国文化'}。\n只输出 JSON（不要任何解释）：{"title_zh":"","title_en":"","slides":[{"heading_zh":"","heading_en":"","points_zh":["..."],"points_en":["..."]}],"summary_zh":"","summary_en":""}。slides 4~6 页，每页 points 3~4 条。`;
      doc = await chatJSON<StudioDoc>({ system, user });
    }
    if (!doc || !Array.isArray(doc.slides) || !doc.slides.length) doc = mockDoc(taskType, topic);
    send('result', { doc, mock: !hasLLM() });
    send('done', {});
  } catch {
    send('result', { doc: mockDoc(taskType, topic), mock: true });
    send('done', {});
  } finally {
    res.end();
  }
});

export default router;
