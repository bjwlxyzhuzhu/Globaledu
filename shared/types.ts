// 寰语星球 · 前后端共享类型（web 与 server 都从这里导入）

/** HSK 等级 1–6 */
export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** 界面语言 */
export type Lang = 'zh' | 'en';

/** 地球仪上的国家点 */
export interface Country {
  code: string; // ISO 两位国家码，如 CN
  name_zh: string;
  name_en: string;
  lat: number;
  lng: number;
  hasContent: boolean; // 是否已有知识库内容（驱动发光点/可进入）
  native_lang?: string; // 母语代码，如 id/th
  welcome_native?: string; // 母语欢迎语（开场用）
}

/** 对话消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** POST /api/chat 请求体（PRD §6） */
export interface ChatRequest {
  sessionId?: string;
  messages: ChatMessage[];
  hskLevel: HskLevel;
  nativeLang?: string;
  country?: string;
  contextDocIds?: string[];
  outputLangs?: string[]; // 回复要包含的语言（如 ['zh','en','fr']），默认 ['zh','en']
  model?: string; // 可选：覆盖默认大模型（来自对话框的模型选择）
  role?: 'culture' | 'language'; // 双师：文化导师（默认，知识问答）/ 中文语言导师（纠错+语法词汇）
}

/** 可选大模型（对话框下拉用） */
export interface ModelInfo {
  id: string;
  label: string;
}

/** 单语回复 */
export interface ReplyItem {
  lang: string; // 语言代码 zh/en/fr/es/ru/ar/de
  text: string;
}

/** 分级 / 反谄媚轻量校验结果 */
export interface LevelCheck {
  vocab_in_level: boolean; // 词汇是否在等级内
  max_sentence_len: number; // 最长句长（按词计）
  sycophancy_flag: boolean; // 是否谄媚空话
  taboo_flag: boolean; // 是否触碰文化禁忌
  over_words?: string[]; // 超纲字样本（M5）
}

/** POST /api/chat 响应体（PRD §6）。多语言：replies 按请求语言各一条，zh 受 HSK 分级约束。 */
export interface ChatReply {
  replies: ReplyItem[]; // 2~3 种语言的回复（第一条通常为中文）
  level_check: LevelCheck;
  suggestions: string[]; // 纠错 / 可执行建议
  mock?: boolean; // 是否为无 key 时的兜底回复
  rag_titles?: string[]; // RAG 命中的知识库文档标题（M5）
}

/** 汉字条目（data/hanzi.json） */
export interface HanziItem {
  char: string;
  pinyin: string;
  strokes: number;
  radical: string;
  hsk: HskLevel;
  story_zh: string;
  story_native: string;
  words: { word: string; pinyin: string; meaning_en: string }[];
}

/** 文化主题（data/learn/culture.json） */
export interface CultureItem {
  id: string;
  emoji?: string;
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
  scenario_zh?: string; // 情境模拟开场设定
  scenario_en?: string;
  city?: string;
  province?: string; // 归属省份（直辖市/港澳台同名；全国性概念为「全国」）
  // 文化主题分类：heritage 文物古迹 / intangible 非遗技艺 / festival 节日节气 / food 饮食茶酒
  // folklore 民俗风情 / art 传统艺术 / thought 思想哲学 / modern 当代中国
  category?: string;
  hskRange?: number[]; // AI 打标签：适合出题的 HSK 难度范围 [min,max]
  refs?: string[]; // AI 打标签：交叉引用关键词（人物/朝代/相关主题）
}

/** 听力短文（data/learn/listening.json） */
export interface ListeningItem {
  id: string;
  hsk: HskLevel;
  title_zh: string;
  title_en: string;
  text_zh: string;
  pinyin: string;
  translation_en: string;
  question_zh: string;
  question_en: string;
  options: { zh: string; en: string }[];
  answer: number; // 正确项下标
}

/** 阅读短文（data/learn/reading.json）——逐词分块便于即点即查 */
export interface ReadingItem {
  id: string;
  hsk: HskLevel;
  title_zh: string;
  title_en: string;
  tokens: { w: string; py?: string; en?: string }[]; // 词/拼音/释义；标点 py/en 省略
  translation_en: string;
}

/** 口语情境（data/learn/speaking.json） */
export interface SpeakingItem {
  id: string;
  hsk: HskLevel;
  scene_zh: string;
  scene_en: string;
  prompt_zh: string; // 角色扮演开场设定
  prompt_en: string;
  target_zh: string; // 跟读目标句
  target_pinyin: string;
  target_en: string;
}

/** HSK 题目（data/learn/hsk.json） */
export interface HskQuizItem {
  id: string;
  level: HskLevel;
  stem_zh: string;
  stem_en: string;
  options: string[];
  answer: number;
  explain_zh: string;
  explain_en: string;
}

/** HSKK 口语命题（data/learn/hskk.json） */
export interface HskkItem {
  id: string;
  band: 'beginner' | 'intermediate' | 'advanced';
  prompt_zh: string;
  prompt_en: string;
  sample_zh: string; // 参考范例答案
}

/** 城市图鉴单项（景点 / 特色美食） */
export interface CityPediaItem {
  name_zh: string;
  name_en: string;
  desc_zh: string;
  desc_en: string;
  img: string; // 配图关键词（前端经 cityImage 生成 AI 图）
  category?: string; // AI 打标签：归入 8 大文化类目
  hskRange?: number[]; // AI 打标签：适合出题的 HSK 难度范围 [min,max]
  refs?: string[]; // AI 打标签：交叉引用关键词
}

/** 城市图鉴（data/citypedia/<城市>.json；无策展时后端按城市名自动兜底，保证任意城市可用） */
export interface CityPedia {
  key: string;
  name_zh: string;
  name_en: string;
  province?: string;
  tier?: string; // new-first | second | third
  intro_zh: string;
  intro_en: string;
  culture_zh?: string;
  culture_en?: string;
  attractions: CityPediaItem[]; // 景点
  foods: CityPediaItem[]; // 特色美食
  auto?: boolean; // 自动兜底（非策展）
}

/** 知识库文档（data/kb_seed/*.md 解析后） */
export interface KbDoc {
  id: string;
  title: string;
  title_en?: string;
  body: string;
  lang: string;
  country?: string;
  city?: string;
  topic?: string;
  tags: string[];
  source?: string;
}

/** AI 出题（中文语言导师按知识库 + HSK 等级现场出的四选一题） */
export interface QuizQuestion {
  stem_zh: string;
  stem_en: string;
  options: string[];
  answer: number; // 正确选项下标
  explain_zh: string;
  explain_en: string;
}
export interface QuizResponse {
  topic: string;
  hskLevel: number;
  questions: QuizQuestion[];
  sources: string[]; // 用到的知识库条目标题
  mock: boolean;
}

/** 省份元数据（data/provinces.json） */
export interface Province {
  id: string; // 路由用短名，如 shaanxi
  name_zh: string; // 与 GeoJSON region 名一致，如 陕西省
  name_en: string;
  adcode: string;
  type: 'province' | 'municipality';
  cityId?: string; // 直辖市直接对应的城市 id
  hasContent: boolean;
}

/** 城市元数据（data/cities.json） */
export interface City {
  id: string; // 如 xian
  province: string; // 所属省 id
  name_zh: string; // 与 GeoJSON region 名一致，如 西安市
  short_zh: string; // 显示用短名，如 西安
  name_en: string;
  hasContent: boolean;
  intro_zh: string;
  intro_en: string;
}

/** 通用 API 错误体 */
export interface ApiError {
  error: string;
  detail?: string;
}
