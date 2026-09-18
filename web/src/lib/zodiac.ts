// 12 生肖「数字人老师」：emoji + 名 + 主题色 + 绑定音色（pitch/rate，声形绑定）+ AI 萌头像。
export interface Zodiac {
  id: string;
  emoji: string;
  name_zh: string;
  name_en: string;
  color: string;
  voice: { pitch: number; rate: number }; // 与形象绑定的音色个性（浏览器 TTS）
  mmVoice: string; // MiniMax 真人音色 id（声形绑定）
  edgeVoice: string; // Edge 神经音色 id（也用作浏览器音色偏好）
}

export const ZODIACS: Zodiac[] = [
  { id: 'rat', emoji: '🐀', name_zh: '鼠', name_en: 'Rat', color: '#9aa7ff', voice: { pitch: 1.6, rate: 1.12 }, mmVoice: 'female-shaonv', edgeVoice: 'zh-CN-XiaoshuangNeural' },
  { id: 'ox', emoji: '🐂', name_zh: '牛', name_en: 'Ox', color: '#c99a6b', voice: { pitch: 0.8, rate: 0.92 }, mmVoice: 'audiobook_male_1', edgeVoice: 'zh-CN-YunjianNeural' },
  { id: 'tiger', emoji: '🐅', name_zh: '虎', name_en: 'Tiger', color: '#ff9f43', voice: { pitch: 1.0, rate: 1.05 }, mmVoice: 'male-qn-badao', edgeVoice: 'zh-CN-YunxiNeural' },
  { id: 'rabbit', emoji: '🐇', name_zh: '兔', name_en: 'Rabbit', color: '#ff9ec7', voice: { pitch: 1.7, rate: 1.08 }, mmVoice: 'female-tianmei', edgeVoice: 'zh-CN-XiaoyouNeural' },
  { id: 'dragon', emoji: '🐉', name_zh: '龙', name_en: 'Dragon', color: '#ffd152', voice: { pitch: 0.85, rate: 1.0 }, mmVoice: 'male-qn-jingying', edgeVoice: 'zh-CN-YunyangNeural' },
  { id: 'snake', emoji: '🐍', name_zh: '蛇', name_en: 'Snake', color: '#7ed957', voice: { pitch: 1.1, rate: 0.95 }, mmVoice: 'female-yujie', edgeVoice: 'zh-CN-XiaohanNeural' },
  { id: 'horse', emoji: '🐎', name_zh: '马', name_en: 'Horse', color: '#ff7b6b', voice: { pitch: 1.05, rate: 1.18 }, mmVoice: 'male-qn-daxuesheng', edgeVoice: 'zh-CN-YunzeNeural' },
  { id: 'goat', emoji: '🐐', name_zh: '羊', name_en: 'Goat', color: '#a0e7e5', voice: { pitch: 1.4, rate: 0.98 }, mmVoice: 'female-chengshu', edgeVoice: 'zh-CN-XiaomengNeural' },
  { id: 'monkey', emoji: '🐒', name_zh: '猴', name_en: 'Monkey', color: '#c08457', voice: { pitch: 1.5, rate: 1.22 }, mmVoice: 'male-qn-qingse', edgeVoice: 'zh-CN-YunxiaNeural' },
  { id: 'rooster', emoji: '🐓', name_zh: '鸡', name_en: 'Rooster', color: '#ff6f91', voice: { pitch: 1.45, rate: 1.1 }, mmVoice: 'presenter_female', edgeVoice: 'zh-CN-XiaoyiNeural' },
  { id: 'dog', emoji: '🐕', name_zh: '狗', name_en: 'Dog', color: '#b0c4de', voice: { pitch: 1.0, rate: 1.0 }, mmVoice: 'presenter_male', edgeVoice: 'zh-CN-YunyeNeural' },
  { id: 'pig', emoji: '🐖', name_zh: '猪', name_en: 'Pig', color: '#ffb5c2', voice: { pitch: 1.2, rate: 0.9 }, mmVoice: 'audiobook_female_1', edgeVoice: 'zh-CN-XiaoxiaoNeural' },
];

export function zodiacById(id?: string | null): Zodiac {
  return ZODIACS.find((z) => z.id === id) || ZODIACS[0];
}

// 国潮·文物风萌化生肖头像：已预生成为静态图（web/public/zodiac/<id>.jpg），秒开、不依赖外网。
// 缺图时由 <SmartImg> 的 fallback 显示 emoji。重新生成：项目根目录 `node gen-zodiac.mjs`。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function zodiacAvatar(z: Zodiac, _opts?: { w?: number; h?: number }): string {
  return `/zodiac/${z.id}.jpg`;
}
