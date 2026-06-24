import { Router } from 'express';
import type { Response } from 'express';
import { synthMiniMax, hasMiniMaxTTS } from '../tts/minimax';
import { synthEdge } from '../tts/edge';

const router = Router();

// 非中文文本用对应语言的萌系 Edge 原生音色（中文用生肖绑定音色，保持老师身份）
const EDGE_LANG_DEFAULT: Record<string, string> = {
  en: 'en-US-AnaNeural',
  fr: 'fr-FR-EloiseNeural',
  es: 'es-ES-ElviraNeural',
  ru: 'ru-RU-SvetlanaNeural',
  ar: 'ar-SA-ZariyahNeural',
  de: 'de-DE-KatjaNeural',
};
const BCP: Record<string, string> = { zh: 'zh-CN', en: 'en-US', fr: 'fr-FR', es: 'es-ES', ru: 'ru-RU', ar: 'ar-SA', de: 'de-DE' };

function sendAudio(res: Response, buf: Buffer) {
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buf);
}

// GET /api/tts/health —— 当前语音提供方
router.get('/tts/health', (_req, res) => {
  res.json({ provider: hasMiniMaxTTS() ? 'minimax' : 'edge' });
});

// POST /api/tts —— 文本转语音。MiniMax(有 key)→Edge 免费神经语音→204(前端回退浏览器 TTS)。
router.post('/tts', async (req, res) => {
  const { text, voiceId, edgeVoice, lang, speed, pitch } = (req.body || {}) as {
    text?: string;
    voiceId?: string;
    edgeVoice?: string;
    lang?: string;
    speed?: number;
    pitch?: number;
  };
  if (!text || typeof text !== 'string') return res.status(400).end();
  const short = (lang || 'zh').split('-')[0];
  const p = pitch ?? 1; // 原始音高比（1=正常）
  const sp = speed ?? 1;

  // 1) MiniMax 真人语音（配置了 key 时）
  if (hasMiniMaxTTS()) {
    const mm = await synthMiniMax(text, { voiceId, speed: sp, pitch: Math.round((p - 1) * 10) });
    if (mm) return sendAudio(res, mm);
  }

  // 2) Edge 免费神经语音（默认）
  const voice = short === 'zh' ? edgeVoice || 'zh-CN-XiaoxiaoNeural' : EDGE_LANG_DEFAULT[short] || edgeVoice || 'zh-CN-XiaoxiaoNeural';
  const edge = await synthEdge(text, {
    voice,
    lang: BCP[short] || 'zh-CN',
    ratePct: Math.round((sp - 1) * 100),
    pitchPct: Math.round((p - 1) * 30),
  });
  if (edge) return sendAudio(res, edge);

  // 3) 都不可用 → 前端回退浏览器 TTS
  return res.status(204).end();
});

export default router;
