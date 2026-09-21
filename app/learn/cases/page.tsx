"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LearnChrome from "../LearnChrome";
import CoachSession from "@/app/apply/CoachSession";

type Case = {
  id: number; code: string; title: string; region: string; industry: string;
  points: string[]; situation: string; task: string; questions: string[];
  image: string | null; doc: string | null;
};

// 50 个案例原始 industry 有 49 种（几乎一案一签）→ 按关键词归并为少数大产业类目（区域真实产业集群）。
// 顺序即优先级：领域类目在前、AI/数字 catch-all 在后，使「AI+文旅」归到文旅而非AI。
const CATEGORIES: { name: string; kw: RegExp }[] = [
  { name: "钛与新材料", kw: /钛|新材料|光子|集成电路|半导体/ },
  { name: "低空经济", kw: /低空/ },
  { name: "现代农业与乡村", kw: /农业|农村|猕猴桃|果业|苹果|乡村|电商/ },
  { name: "文旅与文创", kw: /文旅|文创|研学|文化|遗址/ },
  { name: "健康与医养", kw: /医疗|医药|健康|养老|中医/ },
  { name: "新能源与双碳", kw: /新能源|光伏|储能|电力|能源|双碳/ },
  { name: "先进制造与装备", kw: /汽车|装备|智能制造|机床|焊接|零部件|制造/ },
  { name: "人工智能与数字", kw: /AI|人工智能|数字|硬科技|平台|软件|治理/ },
  { name: "商贸物流与消费", kw: /物流|供应链|消费|老字号|商贸|服务|社会创新|校园/ },
];
function catOf(c: Case): string {
  const hay = c.industry || "";
  for (const cat of CATEGORIES) if (cat.kw.test(hay)) return cat.name;
  return "其他";
}

export default function CasesPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [active, setActive] = useState<Case | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setAuthed(false); return; }
      setAuthed(true);
      supabase.from("cases").select("id,code,title,region,industry,points,situation,task,questions,image,doc")
        .order("code").then(({ data }) => setCases((data as Case[]) || []));
    });
  }, []);

  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cases) { const k = catOf(c); m.set(k, (m.get(k) || 0) + 1); }
    return [...CATEGORIES.map((x) => x.name), "其他"].filter((n) => m.has(n)).map((n) => ({ name: n, n: m.get(n)! }));
  }, [cases]);

  const hasFilter = !!cat || q.trim().length > 0;
  const filtered = useMemo(() => {
    if (!hasFilter) return [];
    return cases.filter((c) => {
      if (cat && catOf(c) !== cat) return false;
      if (q) {
        const hay = (c.title + c.region + c.industry + (c.points || []).join("") + c.situation).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [cases, q, cat, hasFilter]);

  const pill = (on: boolean): React.CSSProperties => ({
    padding: "6px 13px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
    border: "1px solid " + (on ? "rgba(34,211,238,.6)" : "var(--line)"),
    background: on ? "rgba(34,211,238,.14)" : "rgba(255,255,255,.04)", color: on ? "var(--cyan)" : "var(--mut)",
  });

  return (
    <LearnChrome emoji="🐹" title="案例宝库" subtitle="按产业类目筛选 · 选中案例就地提问、可导出问答">
      {authed === false ? (
        <Gate />
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 搜案例 / 产业 / 知识点…"
            style={{ width: "min(360px,100%)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 14, outline: "none", marginBottom: 14 }} />

          {cats.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--mut)", marginRight: 2 }}>产业</span>
              {cats.map((it) => (<span key={it.name} style={pill(cat === it.name)} onClick={() => setCat(cat === it.name ? "" : it.name)}>{it.name}<span style={{ opacity: .6, marginLeft: 4 }}>{it.n}</span></span>))}
            </div>
          )}

          {authed === null ? (
            <div style={{ color: "var(--mut)", padding: "40px 0", textAlign: "center" }}>加载中…</div>
          ) : cases.length === 0 ? (
            <div style={{ color: "var(--mut)", padding: "40px 0", textAlign: "center" }}>暂无案例数据。请先运行入库脚本。</div>
          ) : !hasFilter ? (
            <div style={{ color: "var(--mut)", padding: "48px 0", textAlign: "center", fontSize: 14 }}>
              👆 选一个产业类目，或在上方搜索，查看对应案例（共 {cases.length} 个）
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "var(--mut)", padding: "40px 0", textAlign: "center" }}>没有匹配的案例，换个类目或关键词试试。</div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span>{filtered.length} 个案例{cat && ` · ${cat}`}</span>
                {(cat || q) && <span onClick={() => { setCat(""); setQ(""); }} style={{ cursor: "pointer", color: "var(--cyan)" }}>✕ 清除筛选</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(248px,1fr))", gap: 14 }}>
                {filtered.map((c) => (
                  <div key={c.id} onClick={() => setActive(c)}
                    style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 16, cursor: "pointer", transition: "transform .15s, border-color .2s", display: "flex", flexDirection: "column", gap: 9, minHeight: 132 }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(34,211,238,.5)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "var(--line)"; }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {c.region && <Chip>{c.region}</Chip>}
                      {c.industry && <Chip on>{c.industry}</Chip>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title}</div>
                    {(c.points || []).length > 0 && <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.5 }}>🎯 {(c.points || []).slice(0, 3).join(" · ")}</div>}
                    <span style={{ marginTop: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--cyan)" }}>进入对话 →</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {active && <Detail c={active} onClose={() => setActive(null)} />}
        </>
      )}
    </LearnChrome>
  );
}

function Chip({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, border: "1px solid " + (on ? "rgba(34,211,238,.4)" : "var(--line)"), color: on ? "var(--cyan)" : "var(--mut)" }}>{children}</span>;
}

function Gate() {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 15, marginBottom: 14 }}>登录后即可浏览案例宝库 🐹</div>
      <Link href="/login" style={{ padding: "10px 20px", borderRadius: 12, fontWeight: 700, color: "#05060f", background: "linear-gradient(120deg,var(--cyan),var(--violet))", textDecoration: "none" }}>去登录</Link>
    </div>
  );
}

function Detail({ c, onClose }: { c: Case; onClose: () => void }) {
  const system = `你是“小闯”，针对下面这个区域产业案例答疑、拆解，并且能结合学生“自己想做的商业计划书/项目”给建议。案例《${c.title}》，区域：${c.region}，产业：${c.industry}，核心知识点：${(c.points || []).join("、")}。情境：${c.situation}。课堂任务：${c.task}。学生可能会：①问案例本身；②让你把案例拆成可参赛项目；③结合 TA 自己的项目/BP 与本案例对照、给打磨建议。学生上传材料(📎)时结合附件作答。回答分条、具体、可落地。`;
  const greeting = `这是案例《${c.title}》📌（${c.region}·${c.industry}）。你可以让我「拆解成参赛项目」「分析商业模式」，或者——直接说说你自己想做的项目，我帮你对照这个案例打磨你的商业计划书。问答随时可在上方导出。`;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", background: "rgba(5,6,18,.8)", backdropFilter: "blur(14px)", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(720px,96vw)", maxHeight: "92vh", overflowY: "auto", background: "rgba(10,14,34,.97)", border: "1px solid var(--line)", borderRadius: 20, boxShadow: "0 30px 80px #000a", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>{c.title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          {c.region && <Chip>{c.region}</Chip>}{c.industry && <Chip on>{c.industry}</Chip>}
          {(c.points || []).map((p, i) => <Chip key={i}>{p}</Chip>)}
        </div>
        {c.situation && <p style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.7, marginBottom: 12 }}>{c.situation}</p>}
        <CoachSession key={c.code} system={system} greeting={greeting} accent="#22d3ee" multiline
          exportTitle={`案例问答 · ${c.title}`}
          promptTags={["这个案例的商业模式是什么？", "它的目标用户和痛点是谁？", "我能学到哪些可复用的方法论？"]}
          placeholder="问这个案例，或说说你自己的项目让我帮你对照打磨…（📎 可传资料）"
          quickActions={[
            { label: "🤖 拆解成参赛项目", message: "请把这个案例拆解成可参赛的项目，从①真实用户与痛点 ②机会与价值主张 ③最小可行产品 ④AI如何参与 ⑤参赛赛道与建议 五点展开。" },
            { label: "💼 对照我的商业计划书", message: "我也想做一个项目。请先问我项目是什么、给谁、解决什么问题，再基于这个案例的方法论帮我对照打磨我的商业计划书。" },
          ]} />
      </div>
    </div>
  );
}
