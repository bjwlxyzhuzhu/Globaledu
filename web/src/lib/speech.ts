// Web Speech API 封装：TTS（朗读，可调速）+ ASR（语音识别，浏览器兜底）。
// 全部能力检测 + 优雅降级——不支持时返回 false / 回调 error，页面给打字兜底。
import { authHeaders } from './api';

// ---------- TTS 朗读 ----------
export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let voicesPrimed = false;
function primeVoices() {
  if (voicesPrimed || !ttsSupported()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {};
  voicesPrimed = true;
}

function pickVoice(lang: string, prefer?: string): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices();
  const l = lang.toLowerCase();
  const base = l.split('-')[0];
  const ofLang = vs.filter((v) => v.lang?.toLowerCase().startsWith(l) || v.lang?.toLowerCase().startsWith(base));
  // 1) 该生肖偏好的具体音色  2) 自然/在线神经音色（Edge 浏览器更像真人）  3) 任意同语言
  const byHint = prefer ? ofLang.find((v) => v.name.toLowerCase().includes(prefer.toLowerCase())) : undefined;
  const neural = ofLang.find((v) => /natural|neural|online/i.test(v.name));
  return byHint || neural || ofLang[0];
}

export interface SpeakOpts {
  rate?: number; // 语速 0.5~1.5
  pitch?: number; // 音高 0~2（生肖音色绑定用）
  lang?: string; // 默认 zh-CN
  voiceName?: string; // 指定语音名（精确）
  prefer?: string; // 偏好音色名子串（如 Xiaoshuang），优先匹配该神经音色
  onend?: () => void;
}

/** 朗读一段文本；返回是否成功发起（不支持时 false）。 */
export function speak(text: string, opts: SpeakOpts = {}): boolean {
  if (!ttsSupported()) return false;
  primeVoices();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang || 'zh-CN';
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  const v =
    (opts.voiceName ? window.speechSynthesis.getVoices().find((x) => x.name === opts.voiceName) : undefined) ||
    pickVoice(u.lang, opts.prefer);
  if (v) u.voice = v;
  if (opts.onend) u.onend = opts.onend;
  synth.speak(u);
  return true;
}

export function stopSpeak() {
  stopRemote();
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** 列出可用语音（声音选择用）。某些浏览器首次为空，voiceschanged 后会有。 */
export function listVoices(): { name: string; lang: string }[] {
  if (!ttsSupported()) return [];
  primeVoices();
  return window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }));
}

// ---------- ASR 语音识别 ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SRCtor(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
}

export function asrSupported(): boolean {
  return !!SRCtor();
}

export interface Recognizer {
  stop: () => void;
}

/** 开始识别；onResult(text,isFinal) 持续回调。返回 stop()；不支持时回调 onError('unsupported') 并返回 null。 */
export function startListening(
  handlers: { onResult: (text: string, isFinal: boolean) => void; onError?: (e: string) => void; onEnd?: () => void },
  lang = 'zh-CN',
): Recognizer | null {
  const Ctor = SRCtor();
  if (!Ctor) {
    handlers.onError?.('unsupported');
    return null;
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (ev: any) => {
    let txt = '';
    let isFinal = false;
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      txt += ev.results[i][0].transcript;
      if (ev.results[i].isFinal) isFinal = true;
    }
    handlers.onResult(txt, isFinal);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onerror = (ev: any) => handlers.onError?.(ev.error || 'error');
  rec.onend = () => handlers.onEnd?.();
  try {
    rec.start();
  } catch {
    /* 重复 start 抛错可忽略 */
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}

// ---------- 发音/内容匹配评分（启发式，离线可用）----------
// 去标点后按字符顺序比对：目标字符在识别结果中顺序命中的比例（0~100）。
export function scoreSpeech(target: string, said: string): number {
  const clean = (s: string) => s.replace(/[\s，。、！？,.!?；;：:'"'""（）()【】]/g, '');
  const t = clean(target);
  const u = clean(said);
  if (!t) return 0;
  let i = 0;
  let hit = 0;
  for (const ch of t) {
    const idx = u.indexOf(ch, i);
    if (idx >= 0) {
      hit++;
      i = idx + 1;
    }
  }
  return Math.round((hit / t.length) * 100);
}

// ---------- 后端真人语音（/api/tts：MiniMax→Edge→204）+ 智能回退浏览器 TTS ----------
const BCP: Record<string, string> = { zh: 'zh-CN', en: 'en-US', fr: 'fr-FR', es: 'es-ES', ru: 'ru-RU', ar: 'ar-SA', de: 'de-DE' };
let remoteAudio: HTMLAudioElement | null = null;
let remoteOk: boolean | null = null; // null=未知; false=后端无真人语音(后续跳过省等待); true=可用

export function stopRemote() {
  if (remoteAudio) {
    try {
      remoteAudio.pause();
    } catch {
      /* ignore */
    }
    remoteAudio = null;
  }
}

export interface RemoteOpts {
  voiceId?: string; // MiniMax 音色
  edgeVoice?: string; // Edge 音色
  lang?: string; // 短码 zh/en…
  speed?: number;
  pitch?: number; // 原始音高比（后端按提供方换算）
  onend?: () => void;
}

/** 调用后端 /api/tts 取音频并播放；后端无语音(204)/失败返回 false 并缓存跳过。 */
export async function speakRemote(text: string, opts: RemoteOpts = {}): Promise<boolean> {
  if (remoteOk === false) return false; // 已知后端无真人语音 → 直接回退，省去每次等待
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, voiceId: opts.voiceId, edgeVoice: opts.edgeVoice, lang: opts.lang, speed: opts.speed, pitch: opts.pitch }),
    });
    if (res.status !== 200) {
      // 401（未登录）/429（限流）都只是这次拿不到真人语音，回退浏览器 TTS 即可；
      // 但不要像「后端没配语音」那样永久缓存跳过——登录或限流窗口过后应当重试。
      if (res.status !== 401 && res.status !== 429) remoteOk = false;
      return false;
    }
    const blob = await res.blob();
    if (!blob || blob.size < 256) {
      remoteOk = false;
      return false;
    }
    remoteOk = true;
    stopRemote();
    if (ttsSupported()) window.speechSynthesis.cancel();
    const u = URL.createObjectURL(blob);
    const a = new Audio(u);
    remoteAudio = a;
    a.onended = () => {
      URL.revokeObjectURL(u);
      if (remoteAudio === a) remoteAudio = null;
      opts.onend?.();
    };
    a.onerror = () => {
      URL.revokeObjectURL(u);
      if (remoteAudio === a) remoteAudio = null;
      opts.onend?.();
    };
    await a.play();
    return true;
  } catch {
    return false;
  }
}

export interface SmartSpeakOpts {
  lang?: string; // 短码 zh/en…
  voiceId?: string; // MiniMax 音色
  edgeVoice?: string; // Edge 音色（也用于浏览器音色偏好）
  rate?: number;
  pitch?: number; // 音高比 1=正常
  onend?: () => void;
}

/** 优先后端真人语音（MiniMax/Edge）；不可用时回退浏览器（优先自然/在线神经音色 + 生肖偏好音色）。 */
export async function speakSmart(text: string, o: SmartSpeakOpts = {}): Promise<void> {
  if (!text) {
    o.onend?.();
    return;
  }
  const short = (o.lang || 'zh').split('-')[0];
  const ok = await speakRemote(text, { voiceId: o.voiceId, edgeVoice: o.edgeVoice, lang: short, speed: o.rate, pitch: o.pitch, onend: o.onend });
  if (ok) return;
  // 浏览器回退：从 Edge 音色名提取偏好（zh-CN-XiaoshuangNeural→Xiaoshuang），让各生肖在 Edge 浏览器里也用不同神经音色
  const prefer = o.edgeVoice ? o.edgeVoice.replace(/^[a-z]{2}-[A-Z]{2}-/, '').replace(/(Neural|Multilingual)$/g, '') : undefined;
  const okLocal = speak(text, { lang: BCP[short] || 'zh-CN', rate: o.rate, pitch: o.pitch, prefer, onend: o.onend });
  if (!okLocal) o.onend?.();
}
