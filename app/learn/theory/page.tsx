import LearnChrome from "../LearnChrome";
import AgentModules, { type AgentModule } from "@/app/AgentModules";

const base = "你是“小闯”，双创AI星际·闯关中心的 AI 老师，性格冷静如水、讲解清晰有条理。结合平台知识库把《创新创业基础》讲得通俗、可落地，多结合大学生创赛项目举例。如果学生上传了资料/作业，请结合附件给出针对性讲解或批改。";

const MODULES: AgentModule[] = [
  { key: "think", icon: "💡", title: "创新思维与方法", desc: "设计思维 / TRIZ / 头脑风暴，从想点子到出方案。", points: ["设计思维", "TRIZ", "头脑风暴"],
    system: base + "本次专注「创新思维与方法」模块。", greeting: "我是小闯 💧 这节我们聊「创新思维与方法」。你想先搞懂哪个——设计思维、TRIZ，还是怎么把一个点子打磨成方案？（也可以把你的创意发我看看）",
    prompts: ["设计思维五步法是什么？", "用 TRIZ 帮我化解一个技术矛盾", "帮我把这个点子打磨成方案"] },
  { key: "opp", icon: "🔍", title: "创业机会识别", desc: "从真实痛点和产业变化里发现机会，辨别真伪需求。", points: ["德鲁克七大来源", "痛点挖掘", "用户访谈"],
    system: base + "本次专注「创业机会识别」模块。", greeting: "这节聊「创业机会识别」🔍 你是已经有方向想验证是不是真需求，还是想从零找机会？说说你的领域。",
    prompts: ["德鲁克七大机会来源是什么？", "怎么判断是真需求还是伪需求？", "用户访谈该问哪些问题？"] },
  { key: "bmc", icon: "🧩", title: "商业模式设计", desc: "用商业模式画布把想法变成可持续的生意。", points: ["商业模式画布", "价值主张", "收入模式"],
    system: base + "本次专注「商业模式设计」模块。", greeting: "这节聊「商业模式设计」🧩 把你的项目一句话告诉我，我带你过一遍商业模式画布九要素。",
    prompts: ["商业模式画布九要素是什么？", "帮我设计这个项目的收入模式", "我的价值主张怎么提炼？"] },
  { key: "market", icon: "📈", title: "市场与竞争分析", desc: "市场有多大、对手是谁、凭什么赢。", points: ["TAM/SAM/SOM", "竞品分析", "调研方法"],
    system: base + "本次专注「市场与竞争分析」模块。", greeting: "这节聊「市场与竞争分析」📈 你的目标市场是什么？我教你估算市场规模、拆竞品。",
    prompts: ["怎么估算 TAM/SAM/SOM？", "帮我搭一个竞品分析框架", "市场调研有哪些常用方法？"] },
  { key: "team", icon: "🤝", title: "团队组建与资源整合", desc: "找对人、分好工，研/本/专怎么搭配。", points: ["合伙人画像", "股权分配", "资源对接"],
    system: base + "本次专注「团队组建与资源整合」模块。", greeting: "这节聊「团队与资源」🤝 说说你们现在几个人、什么专业，我帮你看还缺哪类角色、怎么分工。",
    prompts: ["创业团队黄金三角怎么搭？", "股权怎么分配比较合理？", "我们团队还缺什么角色？"] },
  { key: "bp", icon: "🎤", title: "商业计划书与路演", desc: "写好 BP、做好路演、答好辩。", points: ["BP 结构", "路演逻辑", "答辩技巧"],
    system: base + "本次专注「商业计划书与路演」模块。", greeting: "这节聊「BP 与路演」🎤 你是要搭 BP 框架，还是练路演/答辩？（可以把现有 BP 或 PPT 发我帮你改）",
    prompts: ["一份完整 BP 包含哪几部分？", "路演 5 分钟怎么安排节奏？", "评委常问的答辩问题有哪些？"] },
];

export default function TheoryPage() {
  return (
    <LearnChrome emoji="🐘" title="理论知识" subtitle="《创新创业基础》· 选一个模块，进入专属对话">
      <AgentModules modules={MODULES} accent="#22d3ee" />
    </LearnChrome>
  );
}
