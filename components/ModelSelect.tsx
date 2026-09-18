"use client";
// 自定义深色下拉：替代原生 <select>，完全贴合深色玻璃主题（原生 select 弹层在 Windows 无法深色化、分组标题强制白底）。
// 弹层用 fixed 跟随按钮定位，规避模态框 overflow 裁切；空间不足自动上翻；外点/Esc 关闭。
import { useEffect, useRef, useState } from "react";

export type ModelOption = { value: string; label: string };
export type ModelGroup = { label: string; options: ModelOption[] };

export default function ModelSelect({
  value, onChange, groups, placeholder = "选择…", accent = "var(--cyan)",
}: { value: string; onChange: (v: string) => void; groups: ModelGroup[]; placeholder?: string; accent?: string }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const grps = groups.filter((g) => g.options.length);
  const selected = grps.flatMap((g) => g.options).find((o) => o.value === value) || null;

  function toggle() {
    if (open) { setOpen(false); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // 弹层定位：fixed 跟随按钮；下方空间不足则上翻
  const below = rect ? window.innerHeight - rect.bottom : 999;
  const up = !!rect && below < 300 && rect.top > below;
  const panelPos: React.CSSProperties = rect
    ? { position: "fixed", left: rect.left, width: rect.width, zIndex: 3000, ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) }
    : {};

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 10,
          border: `1px solid ${open ? accent : "var(--line)"}`, background: "rgba(255,255,255,.04)",
          color: selected ? "var(--ink)" : "var(--mut)", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
          textAlign: "left", outline: "none", boxShadow: open ? "0 0 0 3px rgba(34,211,238,.16)" : "none", transition: "border-color .15s",
        }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected ? selected.label : placeholder}</span>
        <span style={{ color: accent, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div style={{
          ...panelPos, maxHeight: 300, overflowY: "auto", padding: 6, borderRadius: 12,
          border: "1px solid rgba(120,200,255,.32)", background: "rgba(10,14,32,.97)", backdropFilter: "blur(14px)",
          boxShadow: "0 18px 50px rgba(0,0,0,.55)", animation: "msIn .14s ease-out",
        }}>
          {grps.map((g, gi) => (
            <div key={gi} style={{ marginTop: gi ? 4 : 0 }}>
              {g.label && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", color: "var(--mut)", padding: "6px 10px 4px" }}>{g.label}</div>}
              {g.options.map((o) => {
                const on = o.value === value;
                return (
                  <button key={o.value || "__none"} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                      border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left",
                      color: on ? "#04030f" : "var(--ink)", background: on ? accent : "transparent", fontWeight: on ? 700 : 400,
                    }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                    {on && <span style={{ fontSize: 12 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
          <style>{`@keyframes msIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
        </div>
      )}
    </div>
  );
}
