/** AI 用途 = 可分别绑定的智能体（含数字人语音 TTS） */
export type Purpose = "chat" | "reason" | "text" | "image" | "tts";

export const PURPOSES: {
  key: Purpose; icon: string; label: string; agent: string; desc: string;
}[] = [
  { key: "chat",   icon: "💬", label: "通用对话智能体", agent: "小航 AI 客服 · 老师 · 选题搭子", desc: "日常问答 · 创赛咨询 · 政策答疑 · 选题建议" },
  { key: "reason", icon: "🧠", label: "思考分析智能体", agent: "深度推理 · 答辩评委 · 可行性评估", desc: "复杂推理 · 方案论证 · 答辩模拟 · 商业分析" },
  { key: "text",   icon: "✍️", label: "文本生成智能体", agent: "写作搭子 · BP / 专利 / 合同", desc: "商业计划书 · 专利交底 · 合同 · 申报材料长文" },
  { key: "image",  icon: "🖼️", label: "PPT 配图智能体", agent: "PPT 搭子 · 文生图", desc: "路演配图 · 封面 · 示意图（文字生成图片）" },
  { key: "tts",    icon: "🔊", label: "数字人语音 · TTS", agent: "小航发声 · 语音合成", desc: "把小航的回答转成语音播报（数字人只发声、不做视频）" },
];

export type Region = "cn" | "intl" | "platform";

export type Provider = {
  id: string;
  name: string;   // 全称（下拉里显示）
  short: string;  // 简称（标签里显示）
  region: Region;
  baseUrl: string;
  models: Record<Purpose, string>;
};

/**
 * 主流大模型预设：均为 OpenAI 兼容接口，协议（baseUrl + 模型名）已写好，
 * 用户在面板里选一项即自动填好，只需再粘贴自己的 API Key。模型名可在「协议详情」里改
 * （厂商偶尔更新版本号时，改这里的 model 即可）。
 */
export const PROVIDERS: Provider[] = [
  // 平台默认（不在下拉里出现；不绑定即走它并扣积分）
  { id: "apimart", name: "APIMart · 平台默认", short: "平台默认", region: "platform",
    baseUrl: "https://api.apimart.ai/v1",
    models: { chat: "gpt-4o", reason: "o1", text: "gpt-4o", image: "gpt-image-2", tts: "" } },

  // —— 国内大模型 ——
  { id: "deepseek", name: "DeepSeek 深度求索 · V4", short: "DeepSeek V4", region: "cn",
    baseUrl: "https://api.deepseek.com",
    models: { chat: "deepseek-v4", reason: "deepseek-reasoner", text: "deepseek-v4", image: "", tts: "" } },
  { id: "zhipu", name: "智谱 GLM · 5.2", short: "智谱GLM 5.2", region: "cn",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: { chat: "glm-5.2", reason: "glm-5.2", text: "glm-5.2", image: "cogview-4", tts: "" } },
  { id: "qwen", name: "通义千问 Qwen · 3.7（阿里云百炼）", short: "通义千问 3.7", region: "cn",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: { chat: "qwen-3.7", reason: "qwen-3.7", text: "qwen-3.7", image: "wanx2.1-t2i-turbo", tts: "qwen-tts" } },
  { id: "moonshot", name: "Kimi · 月之暗面 Moonshot", short: "Kimi", region: "cn",
    baseUrl: "https://api.moonshot.cn/v1",
    models: { chat: "moonshot-v1-8k", reason: "kimi-thinking-preview", text: "moonshot-v1-32k", image: "", tts: "" } },
  { id: "minimax", name: "MiniMax · 海螺", short: "MiniMax", region: "cn",
    baseUrl: "https://api.minimaxi.com/v1",
    models: { chat: "MiniMax-Text-01", reason: "MiniMax-Text-01", text: "MiniMax-Text-01", image: "image-01", tts: "" } },

  // —— 国外：仅保留 GPT Image 2 用于「配图 / 文生图」，其余用途不提供海外模型 ——
  { id: "openai", name: "OpenAI · GPT Image 2.0（仅配图 · 文生图）", short: "GPT Image 2", region: "intl",
    baseUrl: "https://api.openai.com/v1",
    models: { chat: "", reason: "", text: "", image: "gpt-image-2", tts: "" } },
];

/** 取某用途下可绑定的供应商，按地区分组（仅保留对该用途有可用模型的；平台默认不进下拉） */
export function providersFor(purpose: Purpose) {
  const has = (p: Provider) => !!p.models[purpose];
  return {
    cn: PROVIDERS.filter((p) => p.region === "cn" && has(p)),
    intl: PROVIDERS.filter((p) => p.region === "intl" && has(p)),
  };
}
