import crypto from 'node:crypto';

// 微软 Edge 在线神经语音（edge-tts）——免费、无需 key、真人级嗓音、多语言多音色。
// 走 Edge「朗读」公开 websocket。用 ws 包带 Origin/UA 头（端点要求），否则回退内置 WebSocket。
// 关键：任何失败都返回 null（上层回退浏览器 TTS），绝不抛出/崩服务。
const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const GEC_VERSION = '1-131.0.2903.112';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wsPkg: any = null;
let wsTried = false;
async function loadWsPkg() {
  if (wsTried) return wsPkg;
  wsTried = true;
  try {
    wsPkg = (await import('ws')).default;
  } catch {
    wsPkg = null;
  }
  return wsPkg;
}

// Edge 端点防滥用令牌：file-time ticks（取整到 5 分钟）+ TrustedToken 的 SHA256（大写）。
// 必须用「浮点」计算复刻 edge-tts（*1e7 在 ~1.3e18 处有精度损失，微软按此校验；BigInt 精确反而 403）。
function secMsGec(): string {
  // 复刻 edge-tts：先 (unix+epoch)/300 取整，再 ×3e9（用 BigInt 保证精确，对应 Python 大整数）
  const win = Math.floor(Date.now() / 1000 + 11644473600) / 300;
  const ticks = BigInt(Math.floor(win)) * 3000000000n;
  return crypto.createHash('sha256').update(`${ticks.toString()}${TRUSTED_TOKEN}`, 'ascii').digest('hex').toUpperCase();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export interface EdgeOpts {
  voice?: string;
  lang?: string;
  ratePct?: number;
  pitchPct?: number;
}

/** 合成语音；成功返回 mp3 Buffer，不可用/失败返回 null（绝不抛出）。 */
export async function synthEdge(text: string, o: EdgeOpts = {}): Promise<Buffer | null> {
  try {
    const Pkg = await loadWsPkg();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GlobalWS = (globalThis as any).WebSocket;
    if (!Pkg && !GlobalWS) return null;

    const voice = o.voice || 'zh-CN-XiaoxiaoNeural';
    const lang = o.lang || 'zh-CN';
    const rate = `${(o.ratePct ?? 0) >= 0 ? '+' : ''}${Math.round(o.ratePct ?? 0)}%`;
    const pitch = `${(o.pitchPct ?? 0) >= 0 ? '+' : ''}${Math.round(o.pitchPct ?? 0)}%`;
    const reqId = crypto.randomUUID().replace(/-/g, '');
    const connId = crypto.randomUUID().replace(/-/g, '');
    const url = `${WSS}?TrustedClientToken=${TRUSTED_TOKEN}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${connId}`;

    return await new Promise<Buffer | null>((resolve) => {
      const chunks: Buffer[] = [];
      let done = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let sock: any = null;
      const finish = (v: Buffer | null) => {
        if (done) return;
        done = true;
        try {
          sock?.close?.();
        } catch {
          /* ignore */
        }
        resolve(v && v.length > 0 ? v : null);
      };
      const timer = setTimeout(() => finish(chunks.length ? Buffer.concat(chunks) : null), 12000);

      const ts = new Date().toString();
      const configMsg = `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
      const ssmlMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml}`;

      const onOpen = () => {
        try {
          sock.send(configMsg);
          sock.send(ssmlMsg);
        } catch {
          clearTimeout(timer);
          finish(null);
        }
      };
      const onText = (s: string) => {
        if (s.includes('Path:turn.end')) {
          clearTimeout(timer);
          finish(Buffer.concat(chunks));
        }
      };
      const onBin = (buf: Buffer) => {
        if (buf.length < 2) return;
        const headerLen = buf.readUInt16BE(0);
        const header = buf.slice(2, 2 + headerLen).toString('utf8');
        if (header.includes('Path:audio')) chunks.push(buf.slice(2 + headerLen));
      };
      const onFail = () => {
        clearTimeout(timer);
        finish(chunks.length ? Buffer.concat(chunks) : null);
      };

      try {
        if (Pkg) {
          sock = new Pkg(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
              Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          sock.on('open', onOpen);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sock.on('message', (data: any, isBinary: any) => {
            if (typeof data === 'string') return onText(data);
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            if (isBinary === false) return onText(buf.toString('utf8'));
            onBin(buf);
          });
          sock.on('error', onFail);
          sock.on('close', onFail);
        } else {
          sock = new GlobalWS(url);
          sock.binaryType = 'arraybuffer';
          sock.onopen = onOpen;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sock.onmessage = (ev: any) => {
            const d = ev.data;
            if (typeof d === 'string') return onText(d);
            onBin(Buffer.from(d as ArrayBuffer));
          };
          sock.onerror = onFail;
          sock.onclose = onFail;
        }
      } catch {
        clearTimeout(timer);
        finish(null);
      }
    });
  } catch {
    return null;
  }
}
