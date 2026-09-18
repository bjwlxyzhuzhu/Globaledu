"use client";
import { useEffect, useState } from "react";
import CoachSession from "@/app/apply/CoachSession";
import { CREW, CREW_BY_KEY, BP_SECTIONS, MAJORS, projectContext, emptyProject, type Project } from "@/lib/crew";
import { downloadWord } from "@/lib/download";

const LS = "crew_project_v1";

/** 创业星舰工作台主体：项目记忆(localStorage) + 选中搭子对话 + 采纳进BP + 导出。
 *  普通页自带左侧花名册；驾驶舱模式由外部传 selKey/onSel 并 hideRoster（底部控制台另渲染）。 */
export default function CrewWorkspace({ selKey, onSel, hideRoster = false }: { selKey?: string; onSel?: (k: string) => void; hideRoster?: boolean }) {
  const [project, setProject] = useState<Project>(emptyProject());
  const [loaded, setLoaded] = useState(false);
  const [innerSel, setInnerSel] = useState("boss");
  const [rev, setRev] = useState(0);
  const [lastReply, setLastReply] = useState("");
  const [adoptTo, setAdoptTo] = useState(BP_SECTIONS[0].key);
  const [msg, setMsg] = useState("");

  const sel = selKey ?? innerSel;
  const pick = (k: string) => { if (onSel) onSel(k); else setInnerSel(k); setLastReply(""); };

  useEffect(() => {
    try { const raw = localStorage.getItem(LS); if (raw) setProject({ ...emptyProject(), ...JSON.parse(raw) }); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { try { localStorage.setItem(LS, JSON.stringify(project)); } catch { /* ignore */ } } }, [project, loaded]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(""), 2600); return () => clearTimeout(t); } }, [msg]);

  const role = CREW_BY_KEY[sel];
  const system = role.system(project.major) + "\n\n【当前项目记忆】\n" + projectContext(project);
  const filled = BP_SECTIONS.filter((s) => (project.sections[s.key] || "").trim());

  function adopt() {
    if (!lastReply.trim()) { setMsg("还没有可采纳的回复"); return; }
    if (adoptTo === "draft") { setProject((p) => ({ ...p, draft: lastReply })); setMsg("✓ 已采纳为 BP 草案（全文）"); }
    else {
      const label = BP_SECTIONS.find((s) => s.key === adoptTo)?.label;
      setProject((p) => ({ ...p, sections: { ...p.sections, [adoptTo]: ((p.sections[adoptTo] || "").trim() ? p.sections[adoptTo] + "\n\n" : "") + lastReply } }));
      setMsg("✓ 已采纳到「" + label + "」");
    }
    setRev((r) => r + 1);
  }
  function exportBP() {
    if (!project.draft.trim() && !filled.length) { setMsg("项目还空着，先和搭子聊几句、采纳进 BP 再导出"); return; }
    const md = project.draft.trim()
      ? project.draft
      : "# " + (project.name || "我的创业项目") + "\n\n" + filled.map((s) => `## ${s.label}\n\n${project.sections[s.key]}`).join("\n\n");
    downloadWord(`商业计划书_${project.name || "项目"}.doc`, project.name || "商业计划书", md);
  }

  const bossActions = sel === "boss"
    ? [
        { label: "🚀 全队生成完整BP", message: "请你作为总负责，统领全队搭子（战略规划/产品设计/技术开发/商业咨询/产业顾问/育人成长/材料撰写），综合各方视角，基于上面的【当前项目记忆】，为我生成一份结构完整、逻辑闭环、可直接参赛的商业计划书；按 痛点与需求/解决方案/目标用户/市场与竞争/商业模式/技术与壁垒/团队与分工/财务与融资/亮点与社会价值 分节，用 Markdown「## 」标题。生成后我会采纳为 BP 草案。" },
        { label: "📋 盘点进度·给行动清单", message: "请盘点我当前项目记忆，指出还缺什么、下一步该做什么、该请哪位搭子出场，给出明确的行动清单。" },
      ]
    : [];

  const sBox: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 14, background: "rgba(255,255,255,.04)" };
  const inp: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13.5, outline: "none", fontFamily: "inherit" };

  return (
    <div>
      <div style={{ ...sBox, padding: 14, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--mut)" }}>项目</span>
        <input value={project.name} onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))} placeholder="给项目起个名…" style={{ ...inp, flex: 1, minWidth: 150 }} />
        <span style={{ fontSize: 13, color: "var(--mut)" }}>专业</span>
        <select value={project.major} onChange={(e) => setProject((p) => ({ ...p, major: e.target.value }))} style={inp}>
          {MAJORS.map((m) => <option key={m} value={m} style={{ background: "#0a0e22" }}>{m}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--mut)" }}>BP {filled.length}/{BP_SECTIONS.length}{project.draft.trim() && " · 含草案"}</span>
        <button onClick={exportBP} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 13, color: "#05060f", cursor: "pointer", background: "linear-gradient(120deg,#ff6b35,#ffb657)", fontFamily: "inherit" }}>⬇ 导出 BP</button>
      </div>

      {msg && <div style={{ fontSize: 12.5, color: "var(--cyan)", marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        {!hideRoster && (
          <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 2 }}>选一位搭子对话 👇</div>
            {CREW.map((c) => {
              const on = sel === c.key;
              return (
                <button key={c.key} onClick={() => pick(c.key)}
                  style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                    border: "1px solid " + (on ? c.color : "var(--line)"), background: on ? `${c.color}1f` : "rgba(255,255,255,.04)" }}>
                  <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 19, background: `${c.color}22`, border: `1px solid ${c.color}66` }}>{c.emoji}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: on ? c.color : "var(--ink)" }}>{c.name}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--mut)" }}>{c.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{role.emoji}</span>
            <b style={{ fontSize: 15, color: role.color }}>{role.name}</b>
            <span style={{ fontSize: 12, color: "var(--mut)" }}>{role.title} · {role.desc}</span>
          </div>
          <CoachSession key={sel + "@" + rev} system={system} greeting={role.greeting} accent={role.color} multiline
            exportTitle={`星舰问答 · ${role.name}`}
            placeholder={`和「${role.name}」聊你的项目…（📎 可传资料）`}
            promptTags={role.prompts}
            quickActions={bossActions}
            onReply={(t) => setLastReply(t)} />

          <div style={{ ...sBox, marginTop: 12, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", opacity: lastReply ? 1 : 0.55 }}>
            <span style={{ fontSize: 12.5, color: "var(--mut)" }}>把上一条回复沉淀到</span>
            <select value={adoptTo} onChange={(e) => setAdoptTo(e.target.value)} style={{ ...inp, padding: "6px 10px" }}>
              {BP_SECTIONS.map((s) => <option key={s.key} value={s.key} style={{ background: "#0a0e22" }}>{s.label}</option>)}
              <option value="draft" style={{ background: "#0a0e22" }}>BP 草案（全文）</option>
            </select>
            <button onClick={adopt} disabled={!lastReply} style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${role.color}88`, background: `${role.color}1f`, color: role.color, fontWeight: 700, fontSize: 12.5, cursor: lastReply ? "pointer" : "default", fontFamily: "inherit" }}>＋ 采纳进 BP</button>
          </div>
        </div>

        <div style={{ width: 320, flexShrink: 0, ...sBox, padding: 14, maxHeight: "72vh", overflowY: "auto" }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>🧠 项目记忆 · BP 沉淀</div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 12 }}>搭子成果采纳到此、可手动编辑；导出 BP 取此处。</div>
          {BP_SECTIONS.map((s) => (
            <div key={s.key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{s.label} <span style={{ color: "var(--mut)", fontWeight: 400 }}>· {s.hint}</span></div>
              <textarea value={project.sections[s.key] || ""} onChange={(e) => setProject((p) => ({ ...p, sections: { ...p.sections, [s.key]: e.target.value } }))}
                placeholder="（空）" rows={(project.sections[s.key] || "").length > 60 ? 4 : 2}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "rgba(255,255,255,.04)", color: "var(--ink)", fontSize: 12.5, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
            </div>
          ))}
          {project.draft.trim() && (
            <div style={{ marginTop: 6, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3, color: "#ff8a5c" }}>🚀 全队 BP 草案</div>
              <textarea value={project.draft} onChange={(e) => setProject((p) => ({ ...p, draft: e.target.value }))} rows={5}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,138,92,.4)", background: "rgba(255,138,92,.06)", color: "var(--ink)", fontSize: 12.5, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
