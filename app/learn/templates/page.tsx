"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LearnChrome from "../LearnChrome";
import CoachSession from "@/app/apply/CoachSession";

type Tpl = { id: number; name: string; category: string; file: string; ext: string; size_kb: number; sort: number };

export default function TemplatesPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [active, setActive] = useState<Tpl | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setAuthed(false); return; }
      setAuthed(true);
      supabase.from("templates").select("id,name,category,file,ext,size_kb,sort").order("sort").then(({ data }) => setTpls((data as Tpl[]) || []));
    });
  }, []);

  const cats = useMemo(() => [...new Set(tpls.map((t) => t.category || "其他").filter(Boolean))], [tpls]);
  const filtered = useMemo(() => tpls.filter((t) => (!cat || (t.category || "其他") === cat) && (!q || (t.name + t.category).toLowerCase().includes(q.toLowerCase()))), [tpls, q, cat]);

  const pill = (on: boolean): React.CSSProperties => ({
    padding: "6px 13px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
    border: "1px solid " + (on ? "rgba(167,139,250,.6)" : "var(--line)"),
    background: on ? "rgba(167,139,250,.16)" : "rgba(255,255,255,.04)", color: on ? "var(--violet)" : "var(--mut)",
  });

  return (
    <LearnChrome emoji="🐨" title="模板宝库" subtitle="按类别选模板 · 下载之外，还能就地问「怎么用 / 按我的项目怎么填」">
      {authed === false ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, marginBottom: 14 }}>登录后即可使用模板宝库 🐨</div>
          <Link href="/login" style={{ padding: "10px 20px", borderRadius: 12, fontWeight: 700, color: "#05060f", background: "linear-gradient(120deg,var(--cyan),var(--violet))", textDecoration: "none" }}>去登录</Link>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 搜模板…"
            style={{ width: "min(360px,100%)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 14, outline: "none", marginBottom: 14 }} />

          {cats.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--mut)", marginRight: 2 }}>类别</span>
              <span style={pill(cat === "")} onClick={() => setCat("")}>全部</span>
              {cats.map((c) => (<span key={c} style={pill(cat === c)} onClick={() => setCat(c)}>{c}</span>))}
            </div>
          )}

          {authed === null ? (
            <div style={{ color: "var(--mut)", padding: "40px 0", textAlign: "center" }}>加载中…</div>
          ) : tpls.length === 0 ? (
            <div style={{ color: "var(--mut)", padding: "40px 0", textAlign: "center" }}>暂无模板数据。请先运行入库脚本 <code>scripts/ingest-m2.mjs</code>。</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(264px,1fr))", gap: 14 }}>
              {filtered.map((t) => (
                <div key={t.id} onClick={() => setActive(t)}
                  style={{ border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 16, cursor: "pointer", transition: "transform .15s, border-color .2s", display: "flex", flexDirection: "column", gap: 9, minHeight: 128 }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(167,139,250,.5)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "var(--line)"; }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, border: "1px solid rgba(167,139,250,.4)", color: "var(--violet)" }}>{t.category || "其他"}</span>
                    <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--mut)" }}>{t.ext.toUpperCase()} · {t.size_kb} KB</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.5 }}>{t.name}</div>
                  <div style={{ marginTop: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--violet)" }}>进入对话 →</span>
                    <a href={t.file} download onClick={(e) => e.stopPropagation()} style={{ marginLeft: "auto", fontSize: 12, color: "var(--cyan)", textDecoration: "none", border: "1px solid rgba(34,211,238,.4)", borderRadius: 999, padding: "4px 11px" }}>⬇ 下载</a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {active && <Detail t={active} onClose={() => setActive(null)} />}
        </>
      )}
    </LearnChrome>
  );
}

function Detail({ t, onClose }: { t: Tpl; onClose: () => void }) {
  const system = `你是“小闯”，针对平台模板答疑并指导学生把模板真正用起来。当前模板：《${t.name}》（类别：${t.category}，格式：${t.ext.toUpperCase()}）。请结合知识库（含《国赛手册》商业计划书十节结构、官方路演 PPT 架构）指导：①这类材料的结构与每一部分该写什么；②怎么结合“我的项目”一步步填（可主动问学生项目信息）；③评委在这部分看重什么、常见失分点。学生上传自己的草稿(📎)时据此批改。回答分条、具体、可操作。`;
  const greeting = `这是模板《${t.name}》📄（${t.category}）。你可以让我讲讲它的结构怎么填、按你的项目带你过一遍，或把你已有的草稿发我帮你改。右上角可下载原始文件，问答可在上方导出。`;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", background: "rgba(5,6,18,.8)", backdropFilter: "blur(14px)", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(720px,96vw)", maxHeight: "92vh", overflowY: "auto", background: "rgba(10,14,34,.97)", border: "1px solid var(--line)", borderRadius: 20, boxShadow: "0 30px 80px #000a", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>{t.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(167,139,250,.4)", color: "var(--violet)" }}>{t.category || "其他"}</span>
          <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--mut)" }}>{t.ext.toUpperCase()} · {t.size_kb} KB</span>
          <a href={t.file} download style={{ marginLeft: "auto", fontSize: 12.5, color: "#05060f", textDecoration: "none", fontWeight: 700, borderRadius: 999, padding: "6px 14px", background: "linear-gradient(120deg,var(--cyan),var(--violet))" }}>⬇ 下载原始文件</a>
        </div>
        <CoachSession key={t.id} system={system} greeting={greeting} accent="#a78bfa" multiline
          exportTitle={`模板问答 · ${t.name}`}
          promptTags={["这个模板每部分该写什么？", "按我的项目带我填一遍", "评委看这部分最看重什么？"]}
          placeholder="问这个模板怎么用，或说说你的项目让我带你填…（📎 可传草稿）"
          quickActions={[
            { label: "📐 讲讲结构怎么填", message: "请讲讲这个模板/这类材料的结构，每一部分该写什么、写到什么程度。" },
            { label: "✍️ 按我的项目带我填", message: "请先问我项目是什么、给谁、解决什么问题，然后带我一步步把这个模板填出来。" },
          ]} />
      </div>
    </div>
  );
}
