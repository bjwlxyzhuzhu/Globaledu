import { create } from 'zustand';
import type { HskLevel, AuthUser } from '@shared/types';
import { api, setToken, getToken } from '../lib/api';

// localStorage 安全读写（预览沙箱禁用时降级，不崩页）
function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

// 已选界面/对话语言：中文必含，可再加英语及其它语言（任意门）
function readUiLangs(): { uiLangs: string[]; extra: string | null } {
  const raw = lsGet('hyxq_ui_langs');
  if (raw) {
    try {
      const arr = JSON.parse(raw) as string[];
      if (Array.isArray(arr) && arr.includes('zh')) {
        return { uiLangs: arr, extra: arr.find((l) => l !== 'zh') || null };
      }
    } catch {
      /* ignore */
    }
  }
  return { uiLangs: ['zh', 'en'], extra: null }; // 首次默认中英
}

const initLangs = readUiLangs();
const DEEPSEEK_V4_MODELS = new Set(['deepseek-v4-pro', 'deepseek-v4-flash']);

function readModel(): string {
  const saved = lsGet('hyxq_llm_model') || '';
  return DEEPSEEK_V4_MODELS.has(saved) ? saved : '';
}

interface AppState {
  lang: string; // 当前界面语言（uiLangs 之一）
  uiLangs: string[]; // 已选语言（必含 zh，+可选英语等任意门）
  extraLang: string | null; // 首个额外语言（兼容旧引用）
  langChosen: boolean; // 是否完成首次语言选择
  setLang: (l: string) => void;
  setLanguages: (extras: string[]) => void; // 确定语言组合：中文 + 选中的其它语言（数组）
  hskLevel: HskLevel;
  setHskLevel: (h: HskLevel) => void;
  openingSeen: boolean;
  markOpeningSeen: () => void;
  hanziProgress: Record<string, number>; // 汉字 → 最佳得分（闯关计分）
  setHanziScore: (char: string, score: number) => void;
  moduleProgress: Record<string, number>; // "<module>:<itemId>" → 最佳得分（听力/阅读/HSK/口语/HSKK）
  setModuleScore: (key: string, score: number) => void;
  model: string; // 当前选择的大模型 id（''=用后端默认）
  setModel: (m: string) => void;
  zodiac: string; // 选定的生肖数字人老师 id（''=默认第一只）
  setZodiac: (z: string) => void;
  // —— 登录态 ——
  currentUser: AuthUser | null; // 当前登录用户（null=游客）
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setUser: (user: AuthUser | null) => void; // me() 校验后刷新
}

export const useStore = create<AppState>((set, get) => ({
  lang: lsGet('hyxq_lang') || 'zh',
  uiLangs: initLangs.uiLangs,
  extraLang: initLangs.extra,
  langChosen: lsGet('hyxq_lang_chosen') === '1',
  setLang: (l) => {
    lsSet('hyxq_lang', l);
    set({ lang: l });
  },
  // 确定语言组合：中文必含 + 选中的其它语言（去重、去 zh）
  setLanguages: (extras) =>
    set((s) => {
      const uniq = Array.from(new Set(extras.filter((l) => l && l !== 'zh')));
      const uiLangs = ['zh', ...uniq];
      lsSet('hyxq_ui_langs', JSON.stringify(uiLangs));
      lsSet('hyxq_lang_chosen', '1');
      const lang = uiLangs.includes(s.lang) ? s.lang : 'zh'; // 当前语言被移除则回退中文
      lsSet('hyxq_lang', lang);
      return { uiLangs, extraLang: uniq[0] || null, langChosen: true, lang };
    }),
  hskLevel: (Number(lsGet('hyxq_hsk')) || 3) as HskLevel,
  setHskLevel: (h) => {
    lsSet('hyxq_hsk', String(h));
    set({ hskLevel: h });
  },
  openingSeen: lsGet('hyxq_opening_seen') === '1',
  markOpeningSeen: () => {
    lsSet('hyxq_opening_seen', '1');
    set({ openingSeen: true });
  },
  hanziProgress: (() => {
    try {
      return JSON.parse(lsGet('hyxq_hanzi') || '{}') as Record<string, number>;
    } catch {
      return {};
    }
  })(),
  setHanziScore: (char, score) =>
    set((s) => {
      const next = { ...s.hanziProgress, [char]: Math.max(s.hanziProgress[char] || 0, score) };
      lsSet('hyxq_hanzi', JSON.stringify(next));
      syncProgress(get, 'hanzi', char, score);
      return { hanziProgress: next };
    }),
  moduleProgress: (() => {
    try {
      return JSON.parse(lsGet('hyxq_module') || '{}') as Record<string, number>;
    } catch {
      return {};
    }
  })(),
  setModuleScore: (key, score) =>
    set((s) => {
      const next = { ...s.moduleProgress, [key]: Math.max(s.moduleProgress[key] || 0, score) };
      lsSet('hyxq_module', JSON.stringify(next));
      const mod = key.split(':')[0]; // "listening:xx" → "listening"
      syncProgress(get, mod, key, score);
      return { moduleProgress: next };
    }),
  model: readModel(),
  setModel: (m) => {
    lsSet('hyxq_llm_model', m);
    set({ model: m });
  },
  zodiac: lsGet('hyxq_zodiac') || '',
  setZodiac: (z) => {
    lsSet('hyxq_zodiac', z);
    set({ zodiac: z });
  },
  currentUser: null,
  login: (user, token) => {
    setToken(token);
    set({ currentUser: user });
  },
  logout: () => {
    setToken('');
    set({ currentUser: null });
  },
  setUser: (user) => set({ currentUser: user }),
}));

// 已登录则把这次成绩同步到服务端（落库 + 重算雷达 + 发学习积分），并刷新本地积分显示。
// 失败静默：游客或离线时仍走 localStorage，不打断学习。
function syncProgress(get: () => AppState, module: string, item: string, score: number): void {
  if (!getToken() || !get().currentUser) return;
  api
    .progress({ module, item, score })
    .then((r) => {
      const u = get().currentUser;
      if (u) useStore.setState({ currentUser: { ...u, credits: r.credits } });
    })
    .catch(() => {
      /* 同步失败忽略 */
    });
}
