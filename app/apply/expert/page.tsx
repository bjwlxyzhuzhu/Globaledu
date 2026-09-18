import LearnChrome from "../../learn/LearnChrome";
import CoachSession from "../CoachSession";

const SYSTEM = `你是“小创”，国赛项目“专家打磨”导师，扮演资深评审专家。当学生粘贴其商业计划书/项目摘要后，依据《中国国际大学生创新大赛(2026)参赛手册》的打磨方法，从五方面逐项审稿：
①核心逻辑链（痛点→方案→技术→价值→团队）是否自洽、有无跳跃或缺失；
②关键数据（市场规模/技术指标/财务预测）是否一致、有无矛盾或夸大；
③竞品分析盲点（遗漏的对手、替代技术路线、潜在新进入者、性能价格之外的维度如生态/服务/定制）；
④项目亮点提炼（最能打动评委的 2-3 个点，给出更有冲击力的表达）；
⑤按国赛评分维度给出可落地的改进建议（分条、具体、可操作）。
语气热情鼓励但要犀利、具体。之后学生可继续追问，你就某一点深入展开。`;

export default function ExpertPage() {
  return (
    <LearnChrome emoji="🦉" title="专家打磨" subtitle="把项目贴进来，AI 专家团按国赛标准逐项挑毛病、提亮点">
      <p style={{ fontSize: 13, color: "var(--mut)", marginBottom: 16, lineHeight: 1.7 }}>
        粘贴你的商业计划书或项目摘要，小创会从【逻辑链 / 数据一致性 / 竞品盲点 / 亮点提炼 / 改进建议】五个方面给你打磨，对标国赛把项目磨成精品。
      </p>
      <CoachSession
        system={SYSTEM}
        greeting="把你的商业计划书或项目摘要粘贴给我（越详细越好）🔥 我会按国赛标准，从逻辑链、数据、竞品、亮点、改进五个方面逐项打磨。"
        placeholder="粘贴你的项目 / BP 摘要…（Shift+Enter 换行）"
        multiline
        exportTitle="专家打磨"
        evidence={{ kind: "expert_review", title: "专家打磨" }}
        promptTags={["帮我看看逻辑链有没有断点", "我的竞品分析有什么盲点？", "帮我提炼 3 个打动评委的亮点"]}
      />
    </LearnChrome>
  );
}
