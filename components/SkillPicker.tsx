"use client";
// 对话框里的「🧩 技能」选择器：直接展示各类技能（内置 / 商店 / 我的）+ 演示插件，点亮即为本次启用（瞬时注入，不改安装状态）。
// 受控组件：active 集合由父级持有。底部留一个去「技能商店」沉淀/管理的小入口。
import { useEffect, useRef, useState } from "react";
import type { Toolbox } from "@/lib/skillsClient";
import { BUILTIN_SKILLS, STORE_SKILLS, SCOPE_LABEL, SKILL_BY_ID, type Skill } from "@/lib/skills";
import { PLUGINS, PLUGIN_BY_ID, pluginInstr } from "@/lib/plugins";

export default function SkillPicker({
  toolbox, activeSkillIds, onToggleSkill, activePluginIds, onTogglePlugin, accent = "#7aa8ff", storeHref = "/apply/skills",
}: {
  toolbox: Toolbox | null;
  activeSkillIds: string[];
  onToggleSkill: (id: string) => void;
  activePluginIds: string[];
  onTogglePlugin: (id: string) => void;
  accent?: string;
  storeHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const mine = toolbox?.mine || [];
  const nActive = activeSkillIds.length + activePluginIds.length;

  function toggle() {
    if (open) { setOpen(false); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const below = rect ? window.innerHeight - rect.bottom : 999;
  const up = !!rect && below < 380 && rect.top > below;
  const panelPos: React.CSSProperties = rect
    ? { position: "fixed", left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 340 - 8)), width: 340, zIndex: 3000, ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) }
    : {};

  const chip = (on: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 999, cursor: "pointer",
    fontSize: 12, fontFamily: "inherit", border: `1px solid ${on ? accent : "rgba(120,200,255,.25)"}`,
    background: on ? accent : "rgba(255,255,255,.05)", color: on ? "#04030f" : "#dce6ff", fontWeight: on ? 700 : 400,
  });

  const skillGroup = (label: string, list: Skill[]) => list.length ? (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8aa0cc", letterSpacing: ".5px", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {list.map((s) => {
          const on = activeSkillIds.includes(s.id);
          return (
            <button key={s.id} type="button" onClick={() => onToggleSkill(s.id)} title={`${s.desc} · 适用：${SCOPE_LABEL[s.scope]}`} style={chip(on)}>
              <span>{s.icon}</span>{s.name}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapRef} style={{ display: "inline-flex" }}>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
          border: `1px solid ${open || nActive ? accent : "var(--line)"}`, background: nActive ? "rgba(122,168,255,.14)" : "rgba(255,255,255,.04)", color: "var(--ink)" }}>
        🧩 技能{nActive ? <span style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: accent, color: "#04030f", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center" }}>{nActive}</span> : null}
      </button>

      {open && (
        <div style={{ ...panelPos, maxHeight: 440, overflowY: "auto", padding: 12, borderRadius: 14, border: "1px solid rgba(120,200,255,.32)", background: "rgba(10,14,32,.98)", backdropFilter: "blur(14px)", boxShadow: "0 18px 50px rgba(0,0,0,.6)" }}>
          <div style={{ fontSize: 11.5, color: "#aebbe0" }}>点亮技能 = 本次启用（注入对应专家）。选好直接开始协作即可。</div>
          {skillGroup("内置技能", BUILTIN_SKILLS)}
          {skillGroup("更多技能", STORE_SKILLS)}
          {skillGroup("我的技能", mine)}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8aa0cc", letterSpacing: ".5px", marginBottom: 6 }}>🔌 插件（真实调用）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PLUGINS.map((p) => {
                const on = activePluginIds.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => onTogglePlugin(p.id)} title={PLUGIN_BY_ID[p.id]?.desc || ""} style={chip(on)}>
                    <span>{p.icon}</span>{p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <a href={storeHref} style={{ display: "block", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(120,200,255,.18)", fontSize: 12, color: accent, textDecoration: "none", fontWeight: 600 }}>＋ 沉淀我的技能 / 管理（技能商店）→</a>
        </div>
      )}
    </div>
  );
}

// 父级用：把激活 id 解析成 Skill[]（内置/商店来自目录，自有来自工具箱）
export function resolveActiveSkills(toolbox: Toolbox | null, activeIds: string[]) {
  const mine = toolbox?.mine || [];
  return activeIds
    .map((id) => SKILL_BY_ID[id] || mine.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);
}

// 父级用：把激活插件转成给模型的真实指令（网页抓取由服务端执行、图表由前端渲染）
export function pluginNote(activePluginIds: string[]): string {
  return pluginInstr(activePluginIds);
}
