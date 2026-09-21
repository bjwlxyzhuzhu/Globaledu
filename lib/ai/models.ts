/** 各 AI 动作的积分单价（默认值；后续可由 app_config.credit_costs 覆盖） */
export const COST = {
  chat: 1, // 对话 / RAG 客服 / AI 老师
  topic: 2, // 选题多轮
  text: 5, // 文本生成（BP/专利/合同）
  ppt: 5, // PPT 大纲
  image: 10, // gpt-image-2 配图（每张）
  defense: 2, // 模拟答辩每轮
  data: 3, // 数据分析
  tts: 1, // 数字人语音播报（每次回答）
  embed: 0, // 入库（管理员，不扣学生分）
} as const;

/** 模型名（从环境变量读取，留默认值） */
export const MODELS = {
  chat: process.env.CHAT_MODEL || "deepseek-chat",
  image: process.env.IMAGE_MODEL || "gpt-image-2",
  tts: process.env.TTS_MODEL || "gpt-4o-mini-tts", // 平台默认音色模型（用户绑千问则走 qwen-tts）
  embed: process.env.EMBED_MODEL || "text-embedding-3-small",
};
