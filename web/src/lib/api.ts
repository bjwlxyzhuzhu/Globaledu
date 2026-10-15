import type { ChatRequest, ChatReply, Country, Province, City, KbDoc, HanziItem, CityPedia, ModelInfo, CultureItem, QuizResponse, WritingGrade, WritingRecord, AuthUser, ClassInfo, RosterRow, StudentDetail, Reward, Redemption, LeaderboardRow } from '@shared/types';

// GeoJSON 用宽松类型（仅交给 echarts.registerMap）
export type GeoJson = Record<string, unknown>;

// 令牌读写（登录态）：存 localStorage，所有请求自动带上 Authorization。
const TOKEN_KEY = 'hyxq_token';
export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
export function setToken(t: string): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 统一的请求头：带上登录令牌。
 * 不走 jsonFetch 的裸 fetch（流式 SSE、二进制音频）也必须用它，
 * 否则后端 gate 会以未登录拒绝——/api/tts 与 /api/studio/generate 就是这种情况。
 */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    // 尝试解析后端的 {error} 文案，给前端更友好的提示
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* 非 JSON，保留状态码 */
    }
    throw new Error(msg);
  }
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
  writingGrade: (body: { text: string; hskLevel: number; prompt?: string; nativeLang?: string; minChars?: number; itemId?: string; title?: string; model?: string }) =>
    jsonFetch<WritingGrade>('/api/writing/grade', { method: 'POST', body: JSON.stringify(body) }),
  writingHistory: () => jsonFetch<{ writings: WritingRecord[] }>('/api/writing/history'),
  models: () => jsonFetch<{ models: ModelInfo[]; default: string }>('/api/models'),
  metrics: () =>
    jsonFetch<{ count: number; vocab_in_level_rate: number; sycophancy_rate: number; taboo_rate: number; avg_sentence_len: number; recent: Record<string, unknown>[] }>(
      '/api/metrics',
    ),
  manifest: () => jsonFetch<Record<string, unknown>>('/api/integration/manifest'),
  chat: (body: ChatRequest) =>
    jsonFetch<ChatReply>('/api/chat', { method: 'POST', body: JSON.stringify(body) }),

  // —— 认证 ——
  login: (body: { account: string; password: string; as: 'student' | 'admin' }) =>
    jsonFetch<{ token: string; user: AuthUser; awarded: number; awardType: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => jsonFetch<{ user: AuthUser }>('/api/auth/me'),
  heartbeat: () => jsonFetch<{ ok: boolean; total_active_sec: number }>('/api/auth/heartbeat', { method: 'POST' }),
  changePassword: (body: { oldPassword: string; newPassword: string }) =>
    jsonFetch<{ ok: boolean }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),

  // —— 积分中心（排行榜 / 兑换）——
  rewards: () => jsonFetch<{ rewards: Reward[] }>('/api/rewards'),
  redeem: (rewardId: string) =>
    jsonFetch<{ ok: boolean; remaining: number; redemption: Redemption }>('/api/redeem', {
      method: 'POST',
      body: JSON.stringify({ rewardId }),
    }),
  myRedemptions: () => jsonFetch<{ redemptions: Redemption[] }>('/api/redemptions/me'),
  leaderboard: () => jsonFetch<{ top: LeaderboardRow[]; me: { rank: number; credits: number } }>('/api/leaderboard'),

  // —— 学习进度（登录后同步成绩，发学习积分）——
  progress: (body: { module: string; item?: string; score: number }) =>
    jsonFetch<{ ok: boolean; awarded: number; credits: number }>('/api/progress', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // —— 管理端 ——
  adminClasses: () => jsonFetch<{ classes: ClassInfo[] }>('/api/admin/classes'),
  adminCreateClass: (body: { name: string; hsk_default: number }) =>
    jsonFetch<{ class: ClassInfo }>('/api/admin/classes', { method: 'POST', body: JSON.stringify(body) }),
  adminImport: (classId: string, students: { name: string; student_no: string; country?: string; hsk?: number }[]) =>
    jsonFetch<{ ok: boolean; added: number; reused: number; createdCount: number; created: { name: string; student_no: string; username: string; initialPassword: string }[] }>(
      `/api/admin/classes/${encodeURIComponent(classId)}/import`,
      { method: 'POST', body: JSON.stringify({ students }) },
    ),
  adminRoster: (classId: string) =>
    jsonFetch<{ class: ClassInfo; roster: RosterRow[] }>(`/api/admin/classes/${encodeURIComponent(classId)}/roster`),
  adminResearchExport: (classId: string) =>
    jsonFetch<Record<string, unknown>>('/api/admin/classes/' + encodeURIComponent(classId) + '/research-export'),
  adminStudent: (id: string) => jsonFetch<StudentDetail>(`/api/admin/students/${encodeURIComponent(id)}`),
  adminStudentWritings: (id: string) => jsonFetch<{ writings: WritingRecord[] }>(`/api/admin/students/${encodeURIComponent(id)}/writings`),
  adminResetPassword: (id: string, newPassword?: string) =>
    jsonFetch<{ ok: boolean; newPassword: string }>(`/api/admin/students/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(newPassword ? { newPassword } : {}),
    }),
  myModules: () => jsonFetch<{ modules: string[]; all: boolean }>('/api/my/modules'),
  adminUpdateClass: (classId: string, body: { name?: string; hsk_default?: number; enabled_modules?: string[] }) =>
    jsonFetch<{ class: ClassInfo }>(`/api/admin/classes/${encodeURIComponent(classId)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminDeleteClass: (classId: string) =>
    jsonFetch<{ ok: boolean; removedMembers: number }>(`/api/admin/classes/${encodeURIComponent(classId)}`, {
      method: 'DELETE',
    }),
  adminRemoveMember: (classId: string, uid: string) =>
    jsonFetch<{ ok: boolean }>(
      `/api/admin/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(uid)}`,
      { method: 'DELETE' },
    ),
  adminDeleteStudent: (uid: string) =>
    jsonFetch<{ ok: boolean; deleted: { name: string; student_no: string } }>(
      `/api/admin/students/${encodeURIComponent(uid)}`,
      { method: 'DELETE' },
    ),
  adminResetClassPasswords: (classId: string, userIds?: string[]) =>
    jsonFetch<{ ok: boolean; count: number; list: { name: string; student_no: string; password: string }[] }>(
      `/api/admin/classes/${encodeURIComponent(classId)}/reset-passwords`,
      { method: 'POST', body: JSON.stringify(userIds && userIds.length ? { userIds } : {}) },
    ),
  adminRedemptions: () => jsonFetch<{ redemptions: Redemption[] }>('/api/admin/redemptions'),
  adminFulfill: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/admin/redemptions/${encodeURIComponent(id)}/fulfill`, { method: 'POST' }),
};
