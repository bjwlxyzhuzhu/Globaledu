// 技能系统：技能 = 一段可注入智能体 system 的「专项方法指令」。
// 目录（内置 + 商店）写在代码里，是平台提供的"货架"；用户的启用/安装/自有技能存 Supabase（见 skillsClient）。
// scope = "all" 注入每个智能体；否则只注入对应搭子 key（boss/strategy/design/teacher/student/industry/mentor/advisor）。

export type SkillScope =
  | "all" | "boss" | "strategy" | "design" | "teacher" | "student" | "industry" | "mentor" | "advisor";
export type SkillSource = "builtin" | "store" | "mine";

export type Skill = {
  id: string; name: string; icon: string; category: string; desc: string;
  instruction: string; scope: SkillScope; source: SkillSource; author?: string;
};

// 适用角色的中文名（UI 展示用）
export const SCOPE_LABEL: Record<SkillScope, string> = {
  all: "全员通用", boss: "总负责", strategy: "战略规划", design: "产品设计",
  teacher: "技术开发", student: "商业咨询", industry: "产业顾问", mentor: "育人成长", advisor: "材料撰写",
};

export const BUILTIN_SKILLS: Skill[] = [
  { id: "biz-canvas", name: "商业模式画布", icon: "🧩", category: "商业", scope: "student", source: "builtin",
    desc: "用九要素画布拆解商业模式",
    instruction: "用商业模式画布九要素逐一输出并落到本项目具体内容：客户细分、价值主张、渠道通路、客户关系、收入来源、核心资源、关键业务、重要伙伴、成本结构。" },
  { id: "swot-pest", name: "SWOT·PEST 分析", icon: "📊", category: "战略", scope: "strategy", source: "builtin",
    desc: "宏观扫描 + 优劣机威交叉策略",
    instruction: "先用 PEST 扫描宏观环境（政策/经济/社会/技术），再用 SWOT 交叉出 SO/WO/ST/WT 四类策略，结论必须落到可执行动作。" },
  { id: "fin-model", name: "财务三表与单位经济", icon: "💰", category: "财务", scope: "student", source: "builtin",
    desc: "收入成本预测 + LTV/CAC 测算",
    instruction: "给出收入预测、成本结构与简化利润/现金流要点；测算单位经济（客单价、毛利率、CAC、LTV、回本周期），并清晰写出每个数字的关键假设与口径，不臆造。" },
  { id: "tech-feas", name: "技术架构与可行性", icon: "🛠️", category: "技术", scope: "teacher", source: "builtin",
    desc: "架构/选型/难点/里程碑",
    instruction: "用文字描述系统架构（模块 + 数据流）、核心技术栈与选型理由、关键技术难点与可行性判断、分阶段开发里程碑，以及技术壁垒如何构建。" },
  { id: "competitor-matrix", name: "竞品对标矩阵", icon: "🆚", category: "市场", scope: "industry", source: "builtin",
    desc: "3-5 竞品多维对比 + 差异化",
    instruction: "选 3-5 个真实或同类竞品，按 功能/价格/目标客群/壁垒/差异 等维度做对比矩阵，明确本项目的差异化优势与切入点。" },
  { id: "persona-jtbd", name: "用户画像·JTBD", icon: "👤", category: "产品", scope: "design", source: "builtin",
    desc: "典型用户 + 待办任务理论",
    instruction: "刻画 1-2 个典型用户画像，并用 JTBD（用户在什么情境、想完成什么任务、当前如何凑合、痛点何在）说明真实需求，避免泛泛而谈。" },
  { id: "defense-qa", name: "答辩问答预测", icon: "🎤", category: "答辩", scope: "boss", source: "builtin",
    desc: "评委尖锐提问 + 应答要点",
    instruction: "站在评委角度预测 6-8 个最可能被追问的尖锐问题（商业模式/数据真实性/壁垒/落地/团队/竞争），每个配 3-5 句有力应答要点。" },
  { id: "pitch-script", name: "路演逐字稿", icon: "📢", category: "路演", scope: "advisor", source: "builtin",
    desc: "3 分钟可脱稿口播稿",
    instruction: "输出约 3 分钟的路演逐字稿：开场抓人 → 痛点 → 方案 → 市场与商业模式 → 亮点 → 团队 → 愿景收尾；口语化、有节奏、能脱稿。" },
  { id: "policy-match", name: "政策匹配与申报点", icon: "📋", category: "政策", scope: "mentor", source: "builtin",
    desc: "对接政策方向 + 加分点",
    instruction: "结合双创及行业相关政策方向，指出本项目可对接的政策与申报加分点（社会价值、就业带动、技术自主、区域发展、乡村振兴等），措辞贴合评审。" },
  { id: "risk-plan", name: "风险与对策清单", icon: "⚠️", category: "通用", scope: "all", source: "builtin",
    desc: "主要风险 + 触发条件 + 对策",
    instruction: "列出项目主要风险（市场/技术/运营/财务/合规），每条配触发条件与具体对策，体现风险意识与可控性。" },
];

export const STORE_SKILLS: Skill[] = [
  { id: "store-research", name: "行业研报速读", icon: "📰", category: "研究", scope: "strategy", source: "store",
    desc: "研报框架快速看清行业",
    instruction: "以行业研报框架快速给出：行业规模与增速、核心驱动因素、产业链结构、主要玩家、趋势与机会，结论服务于本项目的定位与时机判断。" },
  { id: "store-pitch-lines", name: "Pitch 金句库", icon: "✨", category: "路演", scope: "all", source: "store",
    desc: "可直接用的高冲击金句",
    instruction: "为项目提炼 5-8 句可直接用于路演与材料的金句：一句话价值主张、对比金句、数据金句、愿景金句，凝练、有冲击力。" },
  { id: "store-ip", name: "知识产权布局", icon: "🔒", category: "技术", scope: "teacher", source: "store",
    desc: "专利/软著/商标布局",
    instruction: "梳理可申请的专利/软著/商标方向与布局节奏，说明如何用知识产权强化技术壁垒；不得编造已授权的专利或编号。" },
  { id: "store-esg", name: "ESG·社会价值", icon: "🌱", category: "价值", scope: "mentor", source: "store",
    desc: "经济/社会/环境三维价值",
    instruction: "从经济、社会、环境三个维度提炼项目的社会价值与可持续性，尽量具体或量化（就业、降本、环保、普惠、教育等）。" },
  { id: "store-rubric", name: "国奖评分对齐", icon: "🏆", category: "答辩", scope: "boss", source: "store",
    desc: "按评分维度自检补强",
    instruction: "按创赛常见评分维度（创新性/商业性/团队/落地性/社会价值）自检项目，逐项指出当前得分点与补强建议，对齐评审尺度。" },
  { id: "store-term-sheet", name: "融资条款解读", icon: "📑", category: "财务", scope: "student", source: "store",
    desc: "轮次/估值/关键条款",
    instruction: "结合融资需求给出合理的轮次、估值逻辑、资金用途与里程碑，并科普关键条款（股权、对赌、优先清算权）要点与风险提示。" },
];

export const CATALOG: Skill[] = [...BUILTIN_SKILLS, ...STORE_SKILLS];
export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(CATALOG.map((s) => [s.id, s]));

/** 多智能体协作：把命中该搭子（scope=all 或 =agentKey）的激活技能拼成注入文本 */
export function skillInstr(active: Skill[], agentKey: string): string {
  const hit = active.filter((s) => s.scope === "all" || s.scope === agentKey);
  if (!hit.length) return "";
  return "\n\n【已加载技能 · 请运用以下专项方法产出】\n" + hit.map((s) => `· ${s.name}：${s.instruction}`).join("\n");
}

/** 单体对话（数字人）：所有激活技能都生效，不分 scope */
export function skillInstrAll(active: Skill[]): string {
  if (!active.length) return "";
  return "\n\n【已加载技能 · 请运用以下专项方法作答】\n" + active.map((s) => `· ${s.name}：${s.instruction}`).join("\n");
}
