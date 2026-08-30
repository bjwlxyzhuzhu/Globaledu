import OpenAI from 'openai';

// 大模型配置：均在「运行时」读环境变量，避免 ESM import 提升导致读取过早。
// 默认指向 DeepSeek 官方 OpenAI 兼容接口；换网关只需改 .env 的 base_url/model。
function cfg() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.LLM_MODEL || 'deepseek-v4-pro',
  };
}

// DeepSeek 官方 V4 模型。模型名与 https://api.deepseek.com 的 /models 接口保持一致。
export const AVAILABLE_MODELS: { id: string; label: string }[] = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro · 更强' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash · 更快' },
];

const AVAILABLE_MODEL_IDS = new Set(AVAILABLE_MODELS.map(({ id }) => id));

/** 防止旧浏览器缓存或手工请求把 NVIDIA 风格/未知模型名发给 DeepSeek 官方接口。 */
export function normalizeModel(model?: string): string {
  return model && AVAILABLE_MODEL_IDS.has(model) ? model : cfg().model;
}

let client: OpenAI | null = null;
let clientConfigKey = '';
function getClient(): OpenAI | null {
  const { apiKey, baseURL } = cfg();
  if (!apiKey) return null; // 无 key → 上层走 mock 兜底
  const nextConfigKey = `${baseURL}\n${apiKey}`;
  if (!client || clientConfigKey !== nextConfigKey) {
    client = new OpenAI({ apiKey, baseURL });
    clientConfigKey = nextConfigKey;
  }
  return client;
}

export function hasLLM(): boolean {
  return !!cfg().apiKey;
}
export function getModel(): string {
  return cfg().model;
}

export interface ChatJsonOptions {
  system: string;
  user: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  temperature?: number;
  model?: string; // 覆盖默认模型（来自对话框的模型选择）
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// 从可能带代码围栏 / 前后缀说明的文本里抽出 JSON 对象（兼容不支持 json_object 的模型）。
function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return t;
}

/** 调用大模型并要求返回 JSON 对象。无 key 或失败时返回 null（上层走 mock 兜底）。 */
export async function chatJSON<T = unknown>(opts: ChatJsonOptions): Promise<T | null> {
  const c = getClient();
  if (!c) return null;
  const model = normalizeModel(opts.model);
  const messages: Msg[] = [
    { role: 'system', content: opts.system },
    ...(opts.history ?? []),
    { role: 'user', content: opts.user },
  ];
  // 先按 json_object 调用；若模型不支持该参数（部分模型会 400），退回普通调用并宽松解析。
  try {
    const resp = await c.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.6,
      response_format: { type: 'json_object' },
    });
    return JSON.parse(resp.choices[0]?.message?.content ?? '') as T;
  } catch {
    try {
      const resp = await c.chat.completions.create({ model, messages, temperature: opts.temperature ?? 0.6 });
      return JSON.parse(extractJson(resp.choices[0]?.message?.content ?? '')) as T;
    } catch (e) {
      console.warn('[llm] JSON 调用失败，走兜底：', (e as Error).message, '· model=', model);
      return null;
    }
  }
}

/** 纯文本调用；失败返回 null。 */
export async function chatText(opts: ChatJsonOptions): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const model = normalizeModel(opts.model);
  try {
    const messages: Msg[] = [
      { role: 'system', content: opts.system },
      ...(opts.history ?? []),
      { role: 'user', content: opts.user },
    ];
    const resp = await c.chat.completions.create({ model, messages, temperature: opts.temperature ?? 0.7 });
    return resp.choices[0]?.message?.content ?? '';
  } catch (e) {
    console.warn('[llm] 文本调用失败：', (e as Error).message);
    return null;
  }
}
