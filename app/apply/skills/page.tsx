"use client";
// 技能商店：浏览内置 / 商店技能并安装(启用)、沉淀自己的技能、管理演示插件。技能存本地浏览器（localStorage，免登录·免迁移）。
import { useEffect, useState } from "react";
import Link from "next/link";
import AccountButton from "@/components/AccountButton";
import ModelSelect from "@/components/ModelSelect";
import { BUILTIN_SKILLS, STORE_SKILLS, SCOPE_LABEL, type Skill, type SkillScope } from "@/lib/skills";
import { PLUGINS } from "@/lib/plugins";
import { loadToolbox, enableId, disableId, addMine, removeMine, type Toolbox } from "@/lib/skillsClient";

const TABS = [{ k: "builtin", label: "内置技能" }, { k: "store", label: "技能商店" }, { k: "mine", label: "我的技能" }, { k: "plugin", label: "MCP 插件" }] as const;
type TabKey = (typeof TABS)[number]["k"];
const SCOPE_OPTS = (Object.keys(SCOPE_LABEL) as SkillScope[]).map((k) => ({ value: k, label: SCOPE_LABEL[k] }));

export default function SkillsPage() {
  const [toolbox, setToolbox] = useState<Toolbox | null>(null);
  const [tab, setTab] = useState<TabKey>("builtin");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<{ name: string; icon: string; category: string; scope: SkillScope; instruction: string }>({ name: "", icon: "🧩", category: "我的", scope: "all", instruction: "" });

  const refresh = () => loadToolbox().then(setToolbox);
  useEffect(() => { refresh(); }, []);

  const isOn = (id: string) => !!toolbox?.enabledIds.has(id);
  async function toggle(id: string) {
    setBusy(id); setMsg("");
    const ok = isOn(id) ? await disableId(id) : await enableId(id);
    if (!ok) setMsg("操作失败：浏览器本地存储不可用（可能开了隐私/无痕模式）。");
    await refresh(); setBusy("");
  }
  async function create() {
    if (!form.name.trim() || !form.instruction.trim()) { setMsg("请填写技能名称和指令"); return; }
    setBusy("create"); setMsg("");
    const s = await addMine(form);
    setBusy("");
    if (s) { setForm({ name: "", icon: "🧩", category: "我的", scope: "all", instruction: "" }); setMsg("已沉淀到「我的技能」✅"); refresh(); }
    else setMsg("保存失败：浏览器本地存储不可用（可能开了隐私/无痕模式）。");
  }
  async function del(id: string) { setBusy(id); await removeMine(id); await refresh(); setBusy(""); }

  const T = { ink: "#e8f0ff", mut: "#9fb6e0", line: "rgba(120,200,255,.22)", panel: "rgba(7,9,26,.66)" };
  const card = (s: Skill, on: boolean, action: React.ReactNode) => (
    <div key={s.id} style={{ border: `1px solid ${on ? "rgba(52,211,153,.5)" : T.line}`, borderRadius: 14, padding: 14, background: T.panel, backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 22 }}>{s.icon}</span>
        <b style={{ fontSize: 14.5, color: T.ink }}>{s.name}</b>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.mut, padding: "2px 8px", borderRadius: 999, border: `1px solid ${T.line}` }}>{SCOPE_LABEL[s.scope]}</span>
      </div>
      <div style={{ fontSize: 12.5, color: T.mut, lineHeight: 1.6, minHeight: 34 }}>{s.desc}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{action}</div>
    </div>
  );
  const installBtn = (s: Skill) => {
    const on = isOn(s.id);
    return <button onClick={() => toggle(s.id)} disabled={busy === s.id} style={{ padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12.5, color: on ? T.ink : "#04030f", background: on ? "rgba(255,255,255,.08)" : "linear-gradient(120deg,#7aa8ff,#b388ff)" }}>{busy === s.id ? "…" : on ? "✓ 已安装（点击卸载）" : "+ 安装"}</button>;
  };

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12, marginTop: 14 };
  const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 10, border: `1px solid ${T.line}`, background: "rgba(255,255,255,.05)", color: T.ink, fontSize: 13.5, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#04030f", color: T.ink }}>
      <div aria-hidden style={{ position: "fixed", inset: 0, background: "radial-gradient(1100px 700px at 50% -10%, #0c1740, #070b22 55%, #04030f 100%)" }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "16px 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <Link href="/apply/cockpit" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink, textDecoration: "none", padding: "8px 14px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.panel }}>← 返回驾驶舱</Link>
          <span style={{ fontSize: 22 }}>🛒</span>
          <b style={{ fontSize: 19 }}>技能商店</b>
          <span style={{ fontSize: 12.5, color: T.mut }}>装上专项技能 · 让专家搭子更能打</span>
          <div style={{ marginLeft: "auto" }}><AccountButton accent="#7aa8ff" /></div>
        </div>

        <div style={{ fontSize: 12.5, color: "#9fb6e0", background: "rgba(120,200,255,.06)", border: "1px solid rgba(120,200,255,.18)", borderRadius: 10, padding: "9px 13px", marginBottom: 12 }}>技能保存在<b style={{ color: "#cfe0ff" }}>本机浏览器</b>（无需登录、无需配置）。换设备 / 清浏览器缓存会丢失，重要技能记得另存。</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.k} onClick={() => { setTab(t.k); setMsg(""); }} style={{ padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: tab === t.k ? 800 : 500, border: `1px solid ${tab === t.k ? "#7aa8ff" : T.line}`, background: tab === t.k ? "rgba(122,168,255,.16)" : "transparent", color: T.ink }}>{t.label}</button>
          ))}
        </div>
        {msg && <div style={{ fontSize: 12.5, color: msg.includes("✅") ? "#34d399" : "#ff9aa8", marginTop: 10 }}>{msg}</div>}

        {tab === "builtin" && <div style={grid}>{BUILTIN_SKILLS.map((s) => card(s, isOn(s.id), installBtn(s)))}</div>}
        {tab === "store" && <div style={grid}>{STORE_SKILLS.map((s) => card(s, isOn(s.id), installBtn(s)))}</div>}

        {tab === "mine" && (
          <>
            <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: `1px dashed ${T.line}`, background: T.panel }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 10 }}>＋ 沉淀一个我的技能</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="技能名称（如 路演 30 秒电梯稿）" style={{ ...inp, flex: 2, minWidth: 200 }} />
                <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="图标" style={{ ...inp, width: 80, flex: "0 0 auto", textAlign: "center" }} />
                <div style={{ width: 150 }}><ModelSelect value={form.scope} onChange={(v) => setForm({ ...form, scope: v as SkillScope })} groups={[{ label: "适用角色", options: SCOPE_OPTS }]} placeholder="适用角色" /></div>
              </div>
              <textarea value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} rows={3} placeholder="技能指令：告诉智能体该怎么做（会注入到它的提示词里）。例：用 STAR 法把项目经历讲成有说服力的故事。" style={{ ...inp, minHeight: 84, resize: "vertical", lineHeight: 1.6 }} />
              <button onClick={create} disabled={busy === "create"} style={{ marginTop: 10, padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, color: "#04030f", background: "linear-gradient(120deg,#7aa8ff,#b388ff)" }}>{busy === "create" ? "保存中…" : "沉淀技能"}</button>
            </div>
            <div style={grid}>
              {(toolbox?.mine || []).map((s) => card(s, true, (
                <>
                  <span style={{ fontSize: 11.5, color: "#34d399" }}>● 已启用</span>
                  <button onClick={() => del(s.id)} disabled={busy === s.id} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 9, border: `1px solid ${T.line}`, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "#ff9aa8", background: "transparent" }}>{busy === s.id ? "…" : "删除"}</button>
                </>
              )))}
              {!(toolbox?.mine || []).length && <div style={{ color: T.mut, fontSize: 13 }}>还没有自有技能——用上面的表单沉淀第一个。</div>}
            </div>
          </>
        )}

        {tab === "plugin" && (
          <>
            <div style={{ fontSize: 12.5, color: T.mut, marginTop: 14 }}>插件 ——（<b style={{ color: "#8ef0c0" }}>真实功能</b>：网页抓取由服务端真实联网执行；图表在对话内直接渲染。启用后出现在对话框的 🔌 插件区。）</div>
            <div style={grid}>
              {PLUGINS.map((p) => {
                const id = "plugin:" + p.id; const on = isOn(id);
                return (
                  <div key={p.id} style={{ border: `1px solid ${on ? "rgba(52,211,153,.5)" : T.line}`, borderRadius: 14, padding: 14, background: T.panel, display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 22 }}>{p.icon}</span><b style={{ fontSize: 14.5 }}>{p.name}</b><span style={{ marginLeft: "auto", fontSize: 10, color: "#8ef0c0", padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(52,211,153,.35)" }}>真实</span></div>
                    <div style={{ fontSize: 12.5, color: T.mut, minHeight: 20 }}>{p.desc}</div>
                    <button onClick={() => toggle(id)} disabled={busy === id} style={{ padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12.5, color: on ? T.ink : "#04030f", background: on ? "rgba(255,255,255,.08)" : "linear-gradient(120deg,#7aa8ff,#b388ff)" }}>{busy === id ? "…" : on ? "✓ 已启用（点击停用）" : "+ 启用"}</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
