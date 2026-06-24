import type { ChatRequest, ChatReply, Country, Province, City, KbDoc, HanziItem, CityPedia, ModelInfo, CultureItem, QuizResponse } from '@shared/types';

// GeoJSON 用宽松类型（仅交给 echarts.registerMap）
export type GeoJson = Record<string, unknown>;

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => jsonFetch<{ ok: boolean; name: string; llm: string }>('/api/health'),
  countries: () => jsonFetch<Country[]>('/api/countries'),
  provinces: () => jsonFetch<Province[]>('/api/provinces'),
  citylist: () => jsonFetch<{ name: string; province: string }[]>('/api/citylist'),
  cities: (province?: string) =>
    jsonFetch<City[]>(`/api/cities${province ? `?province=${encodeURIComponent(province)}` : ''}`),
  kb: (q: { city?: string; country?: string; topic?: string }) => {
    const params = new URLSearchParams();
    if (q.city) params.set('city', q.city);
    if (q.country) params.set('country', q.country);
    if (q.topic) params.set('topic', q.topic);
    return jsonFetch<KbDoc[]>(`/api/kb?${params.toString()}`);
  },
  geo: (name: string) => jsonFetch<GeoJson>(`/api/geo/${encodeURIComponent(name)}`),
  capitals: () => jsonFetch<Record<string, { lat: number; lng: number; cap: string }>>('/api/capitals'),
  hanzi: () => jsonFetch<HanziItem[]>('/api/hanzi'),
  learn: <T>(module: string) => jsonFetch<T>(`/api/learn/${encodeURIComponent(module)}`),
  citypedia: (city: string) => jsonFetch<CityPedia>(`/api/citypedia/${encodeURIComponent(city)}`),
  cultureLocal: (place: string) => jsonFetch<CultureItem[]>(`/api/culture/local/${encodeURIComponent(place)}`),
  quizGenerate: (body: { topic: string; hskLevel: number; count?: number; nativeLang?: string; model?: string }) =>
    jsonFetch<QuizResponse>('/api/quiz/generate', { method: 'POST', body: JSON.stringify(body) }),
  models: () => jsonFetch<{ models: ModelInfo[]; default: string }>('/api/models'),
  metrics: () =>
    jsonFetch<{ count: number; vocab_in_level_rate: number; sycophancy_rate: number; taboo_rate: number; avg_sentence_len: number; recent: Record<string, unknown>[] }>(
      '/api/metrics',
    ),
  manifest: () => jsonFetch<Record<string, unknown>>('/api/integration/manifest'),
  chat: (body: ChatRequest) =>
    jsonFetch<ChatReply>('/api/chat', { method: 'POST', body: JSON.stringify(body) }),
};
