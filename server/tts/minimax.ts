// MiniMax T2A v2 真人语音合成。无 key 时返回 null（前端回退浏览器 Web Speech TTS）。
// 文档：POST {base}/v1/t2a_v2?GroupId=xxx  Bearer key；返回 data.audio 为 hex 编码的 mp3。
function cfg() {
  return {
    apiKey: process.env.MINIMAX_API_KEY || '',
    groupId: process.env.MINIMAX_GROUP_ID || '',
    base: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com',
    model: process.env.MINIMAX_TTS_MODEL || 'speech-02-turbo',
  };
}

export function hasMiniMaxTTS(): boolean {
  const c = cfg();
  return !!(c.apiKey && c.groupId);
}

export interface TTSOpts {
  voiceId?: string; // MiniMax 系统音色 id（与生肖绑定）
  speed?: number; // 0.5~2
  pitch?: number; // 整数，约 -12~12
}

/** 合成语音；成功返回 mp3 Buffer，未配置或失败返回 null。 */
export async function synthMiniMax(text: string, opts: TTSOpts = {}): Promise<Buffer | null> {
  const c = cfg();
  if (!c.apiKey || !c.groupId) return null;
  try {
    const url = `${c.base}/v1/t2a_v2?GroupId=${encodeURIComponent(c.groupId)}`;
    const body = {
      model: c.model,
      text: text.slice(0, 800),
      stream: false,
      voice_setting: {
        voice_id: opts.voiceId || 'female-shaonv',
        speed: Math.max(0.5, Math.min(2, opts.speed ?? 1)),
        vol: 1,
        pitch: Math.max(-12, Math.min(12, Math.round(opts.pitch ?? 0))),
      },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[minimax-tts] HTTP', res.status);
      return null;
    }
    const json = (await res.json()) as { data?: { audio?: string }; base_resp?: { status_code?: number; status_msg?: string } };
    const hex = json?.data?.audio;
    if (!hex || typeof hex !== 'string') {
      console.warn('[minimax-tts] 无音频返回：', json?.base_resp?.status_msg || 'unknown');
      return null;
    }
    return Buffer.from(hex, 'hex');
  } catch (e) {
    console.warn('[minimax-tts] 调用失败：', (e as Error).message);
    return null;
  }
}
