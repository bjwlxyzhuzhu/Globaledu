"use client";
// 管理端·超星(学习通)对接：管理员填写机构/接口/密钥与能力开关并保存（存 app_config）。
// 测试连接 / 同步名册为演示动作，不真实调用超星开放平台（真对接需学校提供 AppKey/密钥并按其接口适配）。
import { useEffect, useState } from "react";

type Config = {
  enabled: boolean; schoolId: string; baseUrl: string; appKey: string; appSecret: string;
  rosterSync: boolean; sso: boolean; gradePush: boolean;
};
const DEFAULTS: Config = { enabled: false, schoolId: "", baseUrl: "https://api.chaoxing.com", appKey: "", appSecret: "", rosterSync: true, sso: false, gradePush: false };

export default function ChaoxingAdmin() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/chaoxing").then((r) => r.json()).then((d) => { if (d.config) setCfg(d.config); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function act(action: string, label: string) {
    setBusy(action); setMsg("");
    try {
      const r = await fetch("/api/admin/chaoxing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, config: cfg }) });
      const d = await r.json();
      if (!r.ok) setMsg("✗ " + (d.error || r.status));
      else if (action === "save") setMsg("✓ 配置已保存");
      else setMsg((d.ok ? "✓ " : "✗ ") + (d.msg || label));
    } catch { setMsg("✗ 网络错误"); }
    setBusy("");
  }

  const T = { ink: "var(--ink)", mut: "var(--mut)", line: "var(--line)" };
  const box: React.CSSProperties = { border: `1px solid ${T.line}`, borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 18, marginTop: 16 };
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.line}`, background: "rgba(255,255,255,.05)", color: T.ink, fontSize: 13.5, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, color: T.mut, margin: "10px 0 5px", display: "block" };
  const Toggle = ({ on, set, text, hint }: { on: boolean; set: (v: boolean) => void; text: string; hint?: string }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer" }}>
      <span onClick={() => set(!on)} style={{ width: 40, height: 22, borderRadius: 999, background: on ? "linear-gradient(120deg,#22d3ee,#7c5cff)" : "rgba(255,255,255,.12)", position: "relative", flex: "0 0 auto", transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
      </span>
      <span style={{ fontSize: 13.5, color: T.ink, fontWeight: 600 }}>{text}</span>
      {hint && <span style={{ fontSize: 11.5, color: T.mut }}>{hint}</span>}
    </label>
  );
  const btn = (bg: string): React.CSSProperties => ({ padding: "9px 18px", borderRadius: 10, border: bg === "ghost" ? `1px solid ${T.line}` : "none", cursor: "pointer", fontWeight: 700, fontSize: 13, color: bg === "ghost" ? T.ink : "#05060f", background: bg === "ghost" ? "transparent" : bg, fontFamily: "inherit" });

  if (loading) return <div style={{ color: T.mut, fontSize: 13 }}>加载配置中…</div>;

  return (
    <div>
      <div style={{ fontSize: 13, color: "#ffd9b0", background: "rgba(255,180,80,.1)", border: "1px solid rgba(255,180,80,.3)", borderRadius: 10, padding: "10px 13px" }}>
        🔗 超星（学习通）对接：填好机构与接口凭据即可对接学校超星平台。<b>「测试连接 / 同步名册」当前为演示</b>——真实对接需学校在超星开放平台开通并提供 AppKey/密钥，再按其接口联调。
      </div>

      <div style={box}>
        <Toggle on={cfg.enabled} set={(v) => setCfg({ ...cfg, enabled: v })} text="启用超星对接" hint="关闭则平台不与超星交互" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 6 }}>
          <div>
            <label style={lbl}>机构 / 学校代码</label>
            <input style={inp} value={cfg.schoolId} onChange={(e) => setCfg({ ...cfg, schoolId: e.target.value })} placeholder="如 fid / 学校在超星的机构号" />
          </div>
          <div>
            <label style={lbl}>接口地址（Base URL）</label>
            <input style={inp} value={cfg.baseUrl} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} placeholder="https://api.chaoxing.com" />
          </div>
          <div>
            <label style={lbl}>AppKey</label>
            <input style={inp} value={cfg.appKey} onChange={(e) => setCfg({ ...cfg, appKey: e.target.value })} placeholder="超星开放平台 AppKey" />
          </div>
          <div>
            <label style={lbl}>AppSecret</label>
            <input style={inp} type="password" value={cfg.appSecret} onChange={(e) => setCfg({ ...cfg, appSecret: e.target.value })} placeholder="超星开放平台密钥" autoComplete="new-password" />
          </div>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>对接能力</div>
        <Toggle on={cfg.rosterSync} set={(v) => setCfg({ ...cfg, rosterSync: v })} text="名册同步" hint="从超星拉取班级 / 学生，批量建号" />
        <Toggle on={cfg.sso} set={(v) => setCfg({ ...cfg, sso: v })} text="超星账号登录（SSO）" hint="学生用学习通账号一键登录本平台" />
        <Toggle on={cfg.gradePush} set={(v) => setCfg({ ...cfg, gradePush: v })} text="学时 / 积分回传" hint="把平台使用情况回写超星学时" />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={() => act("save", "保存")} disabled={!!busy} style={btn("linear-gradient(120deg,#22d3ee,#7c5cff)")}>{busy === "save" ? "保存中…" : "保存配置"}</button>
        <button onClick={() => act("test", "测试连接")} disabled={!!busy} style={btn("ghost")}>{busy === "test" ? "测试中…" : "🔌 测试连接（演示）"}</button>
        <button onClick={() => act("sync-roster", "同步名册")} disabled={!!busy || !cfg.rosterSync} style={btn("ghost")}>{busy === "sync-roster" ? "同步中…" : "📥 同步名册（演示）"}</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith("✓") ? "#34d399" : "#ff9aa8" }}>{msg}</span>}
      </div>
    </div>
  );
}
