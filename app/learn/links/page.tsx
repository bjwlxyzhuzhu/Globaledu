import LearnChrome from "../LearnChrome";

type Link = { icon: string; title: string; desc: string; url?: string; tag: string };

const LINKS: Link[] = [
  { icon: "🏆", title: "我爱竞赛网", desc: "各类大学生竞赛信息、报名通知、获奖名单与经验汇总。", url: "https://www.52jingsai.com/", tag: "赛事资讯" },
  { icon: "🧠", title: "江苏省人工智能学会 · 会员", desc: "加入学会、了解 AI 学术活动与会员权益（攒经历、拓资源）。", url: "https://www.jsai.org.cn/guide", tag: "学会会员" },
  { icon: "🎓", title: "橙点同学 · 网课", desc: "创新创业与技能类在线课程，按需补课、夯实基础。", url: "https://www.orange-class.com/courses", tag: "在线网课" },
  { icon: "💼", title: "线上实习", desc: "对接线上实习与项目实践，积累作品与经历（链接即将开放）。", tag: "实习实践" },
];

export default function LinksPage() {
  return (
    <LearnChrome emoji="☄️" title="平台直达" subtitle="一键跳转攒经验、拿证书 · 合规导流">
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, marginBottom: 20, background: "rgba(245,166,35,.08)", border: "1px solid rgba(245,166,35,.3)", fontSize: 12.5, color: "var(--ink)", lineHeight: 1.7 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span>本栏目仅提供<b>合规导流</b>：不代刷课、不代答题、不伪造证书。请遵守各平台规则与学术诚信，成果归你本人、AI 仅作辅助。</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {LINKS.map((l) => (
          <div key={l.title} style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)", padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{l.icon}</span>
              <h3 style={{ fontSize: 15.5, fontWeight: 800 }}>{l.title}</h3>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--cyan)", border: "1px solid rgba(34,211,238,.35)", borderRadius: 999, padding: "2px 9px" }}>{l.tag}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.65, marginBottom: 14, flex: 1 }}>{l.desc}</p>
            {l.url ? (
              <a href={l.url} target="_blank" rel="noopener noreferrer"
                style={{ alignSelf: "flex-start", padding: "9px 18px", borderRadius: 11, fontWeight: 700, fontSize: 13, color: "#05060f", background: "linear-gradient(120deg,var(--cyan),var(--violet))", textDecoration: "none" }}>
                前往 →
              </a>
            ) : (
              <span style={{ alignSelf: "flex-start", padding: "9px 18px", borderRadius: 11, fontWeight: 700, fontSize: 13, color: "var(--mut)", background: "rgba(255,255,255,.05)", border: "1px solid var(--line)" }}>
                即将开放
              </span>
            )}
          </div>
        ))}
      </div>
    </LearnChrome>
  );
}
