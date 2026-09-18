// 验证：专家提示词 + 技能注入对产出的影响。直接用真实的 crew.ts / skills.ts 模块，调 DeepSeek。
// 运行：node scripts/test-skills.ts （Node 25 原生剥离 TS 类型）
import { readFileSync } from "node:fs";
import { CREW_BY_KEY } from "../lib/crew.ts";
import { SKILL_BY_ID, skillInstr } from "../lib/skills.ts";

// 读 .env.local 里未注释的 CHAT_*
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const BASE = env.CHAT_BASE_URL, KEY = env.CHAT_API_KEY, MODEL = env.CHAT_MODEL || "deepseek-chat";

const PROJECT = "项目：面向大学生的 AI 简历优化与求职辅导平台「职升机」——用 AI 给简历打分改写、模拟面试、岗位匹配，按次/会员收费。";
const USER = "请基于这个项目，给出你的专业分析（控制在 400 字内）。";

async function ask(system: string): Promise<string> {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, temperature: 0.5,
      messages: [{ role: "system", content: system }, { role: "user", content: `${PROJECT}\n${USER}` }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d.choices[0].message.content.trim();
}

const agent = CREW_BY_KEY["student"];           // 商业咨询 · 敏捷豹（专家提示词）
const skill = SKILL_BY_ID["biz-canvas"];        // 技能：商业模式画布（scope=student）
const sysExpert = agent.system("通用 / 其他专业");
const sysExpertSkill = sysExpert + skillInstr([skill], "student");

console.log("== 模型 ==", MODEL, "@", BASE);
console.log("\n【注入的技能指令片段】", skillInstr([skill], "student").trim(), "\n");
console.log("==================== A · 专家提示词（未挂技能） ====================");
console.log(await ask(sysExpert));
console.log("\n==================== B · 专家提示词 + 「商业模式画布」技能 ====================");
console.log(await ask(sysExpertSkill));
console.log("\n[完成] 对比 A/B：B 应出现商业模式画布九要素、结构更专业。");
