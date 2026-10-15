"use client";
// 云端「我的项目」弹窗：列出本人保存的项目（教师后台可见），可载入/删除。表未建时提示先跑 0005 迁移。
import { useEffect, useState } from "react";

type Item = { id: string; name: string; updated_at: string };
export type CloudProject = { id: string; name: string; draft: string; sections: Record<string, string>; team: string[] };

export default function CloudProjects({ dark, onLoad, onClose }: { dark: boolean; onLoad: (p: CloudProject) => void; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/projects");
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) setMsg("请先登录后再使用云端项目（右上角 → 登录）");
        else if (d.needMigration) setMsg("云端存储未启用：请先在 Supabase 运行 0005_projects 迁移即可生效");
        else setItems(d.items || []);
      } catch { setMsg("网络错误，请稍后重试"); }
      setLoading(false);
    })();
  }, []);

  async function load(id: string) {
    setBusy(id);
    try { const r = await fetch("/api/projects?id=" + id); const d = await r.json().catch(() => ({})); if (d.project) onLoad(d.project); else setMsg("加载失败"); }
    catch { setMsg("网络错误"); }
    setBusy("");
  }
  async function del(id: string) {
    setBusy(id);
    try { const r = await fetch("/api/projects?id=" + id, { method: "DELETE" }); if (r.ok) setItems((x) => x.filter((i) => i.id !== id)); else setMsg("删除失败"); }
    catch { setMsg("网络错误"); }
    setBusy("");
  }

  const ink = dark ? "#e8f0ff" : "#16233c", mut = dark ? "#9fb6e0" : "#5a6b86";
  const panel: React.CSSProperties = { width: "min(520px,94vw)", maxHeight: "84vh", overflowY: "auto", padding: 18, borderRadius: 16, border: `1px solid ${dark ? "rgba(120,200,255,.22)" : "rgba(80,120,200,.28)"}`, background: dark ? "rgba(7,9,26,.92)" : "rgba(255,255,255,.96)", backdropFilter: "blur(12px)", color: ink };
  const rowBtn: React.CSSProperties = { padding: "6px 11px", borderRadius: 8, border: `1px solid ${dark ? "rgba(120,200,255,.3)" : "rgba(80,120,200,.3)"}`, background: "transparent", color: ink, fontSize: 12, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "grid", placeItems: "center", background: "rgba(4,3,15,.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>☁</span>
          <b style={{ fontSize: 15 }}>我的项目 · 云端</b>
          <span style={{ fontSize: 11.5, color: mut }}>换设备可续、教师后台可查</span>
          <button onClick={onClose} style={{ ...rowBtn, marginLeft: "auto" }}>✕ 关闭</button>
        </div>
        {loading && <div style={{ fontSize: 13, color: mut, padding: "16px 0", textAlign: "center" }}>加载中…</div>}
        {!loading && msg && <div style={{ fontSize: 12.5, color: "#ffb066", lineHeight: 1.7, padding: "10px 12px", borderRadius: 10, background: dark ? "rgba(255,176,102,.1)" : "rgba(255,176,102,.14)" }}>{msg}</div>}
        {!loading && !msg && items.length === 0 && <div style={{ fontSize: 13, color: mut, padding: "16px 0", textAlign: "center" }}>还没有云端项目。生成 BP 后点「☁ 保存到云」即可。</div>}
        {!loading && items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", borderBottom: `1px solid ${dark ? "rgba(120,200,255,.12)" : "rgba(80,120,200,.14)"}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name || "（未命名）"}</div>
              <div style={{ fontSize: 11, color: mut }}>{new Date(it.updated_at).toLocaleString("zh-CN")}</div>
            </div>
            <button onClick={() => load(it.id)} disabled={!!busy} style={{ ...rowBtn, color: "#7aa8ff", borderColor: "#7aa8ff66" }}>{busy === it.id ? "…" : "载入"}</button>
            <button onClick={() => del(it.id)} disabled={!!busy} style={{ ...rowBtn, color: "#ff8a96", borderColor: "rgba(255,138,150,.4)" }}>删除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
