import "server-only";
// 插件·网页抓取（P3 真实功能）：从用户消息里提取网址，服务端抓取正文注入上下文。
// 安全与稳健：仅 http/https、拒绝内网地址（防 SSRF）、6 秒超时、正文截断、10 分钟内存缓存
//（驾驶舱多搭子协作会对同一网址反复调用，缓存避免重复抓取拖慢流程）。

const CACHE = new Map<string, { text: string; ts: number }>();
const TTL = 10 * 60 * 1000;
const MAX_CHARS = 6000;

/** 从文本中提取最多 n 个 http(s) 网址 */
export function extractUrls(text: string, n = 2): string[] {
  const m = text.match(/https?:\/\/[^\s"'<>）)\]，。；;]+/g) || [];
  return [...new Set(m)].slice(0, n);
}

function isPrivateHost(host: string): boolean {
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(host)) return true;
  const m = host.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  return false;
}

/** 粗剥 HTML → 可读正文（无第三方依赖，够用即可） */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** 抓取一个网址的正文。失败返回 null（调用方如实告知抓取失败，不编造）。 */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return null;
    const hit = CACHE.get(url);
    if (hit && Date.now() - hit.ts < TTL) return hit.text;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShuangchuangAI/1.0)", Accept: "text/html,*/*" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(ctype)) return null;
    const raw = (await res.text()).slice(0, 400000);
    const text = (/(html|xhtml)/.test(ctype) ? htmlToText(raw) : raw).slice(0, MAX_CHARS);
    if (!text) return null;
    CACHE.set(url, { text, ts: Date.now() });
    if (CACHE.size > 100) { const k = CACHE.keys().next().value; if (k) CACHE.delete(k); }
    return text;
  } catch { return null; }
}

/** 组装注入上下文的【网页抓取】资料块（含失败标注） */
export async function webfetchBlock(userText: string): Promise<{ block: string; fetched: { url: string; ok: boolean }[] }> {
  const urls = extractUrls(userText);
  if (!urls.length) return { block: "", fetched: [] };
  const parts: string[] = [];
  const fetched: { url: string; ok: boolean }[] = [];
  for (const url of urls) {
    const text = await fetchPage(url);
    fetched.push({ url, ok: !!text });
    parts.push(text
      ? `【网页抓取 · ${url}】\n${text}`
      : `【网页抓取 · ${url}】（抓取失败：网页不可达或非文本内容，请如实告知用户）`);
  }
  return { block: "\n" + parts.join("\n\n"), fetched };
}
