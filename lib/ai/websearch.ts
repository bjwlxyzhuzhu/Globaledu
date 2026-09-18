import "server-only";

/**
 * 联网检索（可选）：仅当配置了 SEARCH_API_URL + SEARCH_API_KEY（Tavily 兼容）时才真正联网，
 * 否则返回 null（调用方据此降级为"仅用知识库作答"并提示用户）。这样功能随配置即时点亮、不伪造结果。
 */
export async function webSearch(query: string): Promise<{ text: string; items: { title: string; url: string }[] } | null> {
  const url = process.env.SEARCH_API_URL;
  const key = process.env.SEARCH_API_KEY;
  const q = (query || "").trim();
  if (!url || !key || !q) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query: q.slice(0, 400), max_results: 5, search_depth: "basic" }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    const results = Array.isArray(j?.results) ? j.results : [];
    if (!results.length) return null;
    const items = results.map((x) => ({ title: x.title || "", url: x.url || "" }));
    const text = results.map((x, i) => `【网页${i + 1}·${x.title || ""}】${(x.content || "").slice(0, 400)}（${x.url || ""}）`).join("\n");
    return { text, items };
  } catch { return null; }
}
