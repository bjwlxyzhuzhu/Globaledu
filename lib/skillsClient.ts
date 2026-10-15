"use client";
// 技能存取：改为「本地浏览器」(localStorage)，不依赖服务器表 / 登录 / 迁移。
// 目录（内置 + 商店技能）在 lib/skills.ts；这里只存「已安装/启用的 id」与「沉淀的自有技能」。
// 好处：零配置、免登录、免迁移、不受国内访问 Supabase 超时影响。代价：按浏览器存、不跨设备同步。
import { SKILL_BY_ID, type Skill, type SkillScope } from "@/lib/skills";
import { logClientEvidence } from "@/lib/evidenceClient";

export type Toolbox = {
  enabledCatalog: Skill[];   // 已安装/启用的内置+商店技能
  mine: Skill[];             // 沉淀的自有技能（创建即在工具箱）
  enabledIds: Set<string>;   // 已启用的原始 id（含 catalog id 与 'plugin:xxx'）
  enabledPluginIds: string[];
};

const ENABLED_KEY = "sk_enabled_v1";
const MINE_KEY = "sk_mine_v1";
const MINE_PREFIX = "mine:";
const PLUGIN_PREFIX = "plugin:";

function readArr<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T[]) : []; } catch { return []; }
}
function writeArr(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* localStorage 不可用则忽略 */ }
}

/** 读取本地技能工具箱（已启用目录技能 + 自有技能 + 已启用插件） */
export async function loadToolbox(): Promise<Toolbox> {
  const ids = readArr<string>(ENABLED_KEY);
  const enabledIds = new Set(ids);
  const enabledCatalog = ids.filter((id) => SKILL_BY_ID[id]).map((id) => SKILL_BY_ID[id]);
  const enabledPluginIds = ids.filter((id) => id.startsWith(PLUGIN_PREFIX)).map((id) => id.slice(PLUGIN_PREFIX.length));
  const mine = readArr<Skill>(MINE_KEY);
  return { enabledCatalog, mine, enabledIds, enabledPluginIds };
}

/** 安装/启用一个目录技能或插件（catalog id 或 'plugin:'+id） */
export async function enableId(skillId: string): Promise<boolean> {
  const ids = readArr<string>(ENABLED_KEY);
  if (!ids.includes(skillId)) {
    ids.push(skillId); writeArr(ENABLED_KEY, ids);
    const name = SKILL_BY_ID[skillId]?.name || skillId;
    logClientEvidence("skill_use", { title: `启用技能 · ${name}`, payload: { skillId } });
  }
  return true;
}

/** 卸载/停用 */
export async function disableId(skillId: string): Promise<boolean> {
  writeArr(ENABLED_KEY, readArr<string>(ENABLED_KEY).filter((x) => x !== skillId));
  return true;
}

/** 沉淀一个自有技能（本地保存，创建即在工具箱） */
export async function addMine(s: { name: string; icon: string; category: string; scope: SkillScope; instruction: string }): Promise<Skill | null> {
  const skill: Skill = {
    id: MINE_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: s.name, icon: s.icon || "🧩", category: s.category || "我的", desc: "自有技能",
    instruction: s.instruction, scope: s.scope, source: "mine",
  };
  const mine = readArr<Skill>(MINE_KEY);
  mine.unshift(skill);
  writeArr(MINE_KEY, mine);
  return skill;
}

/** 删除自有技能 */
export async function removeMine(skillId: string): Promise<boolean> {
  writeArr(MINE_KEY, readArr<Skill>(MINE_KEY).filter((s) => s.id !== skillId));
  return true;
}
