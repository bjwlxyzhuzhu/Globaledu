"use client";
// 当前页登录弹窗：在任意页面点「登录」即就地弹出，登录成功后停留在当前页（不跳首页）。
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DOMAIN = "bjwlxy.lab"; // 学号伪邮箱域名（与 seed 一致）

export default function LoginModal({ open, onClose, onSuccess, accent = "#22d3ee" }: { open: boolean; onClose: () => void; onSuccess?: () => void; accent?: string }) {
  const [no, setNo] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [sso, setSso] = useState(""); // 学习通演示登录步骤："" | "auth" | "login"
  const router = useRouter();
  if (!open) return null;

  // 演示「用学习通登录」：模拟跳转超星授权 → 回调 → 以演示学生账号登录（不真实对接超星）
  async function ssoLogin() {
    if (sso || loading) return;
    setErr(""); setSso("auth");
    await new Promise((r) => setTimeout(r, 1100)); // 模拟跳转学习通授权
    setSso("login");
    await new Promise((r) => setTimeout(r, 700));  // 模拟授权回调
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: `202596057038@${DOMAIN}`, password: "Student@2026" });
      if (error) { setErr("学习通登录失败（演示）：" + (error.message || "")); setSso(""); return; }
      router.refresh(); onSuccess?.(); onClose();
    } catch { setErr("网络错误，请确认能访问 Supabase"); setSso(""); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!no.trim() || !pwd) { setErr("请输入学号和密码"); return; }
    setErr(""); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: `${no.trim()}@${DOMAIN}`, password: pwd });
      if (error) { setErr("登录失败：" + (error.message || "学号或密码错误")); setLoading(false); return; }
      router.refresh();      // 刷新当前页服务端内容，URL 不变、不跳首页
      onSuccess?.();
      onClose();
    } catch { setErr("网络错误，请确认能访问 Supabase（国内需代理）"); setLoading(false); }
  }

  const input: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid rgba(120,200,255,.25)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, display: "grid", placeItems: "center", background: "rgba(4,3,15,.66)", backdropFilter: "blur(5px)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: "min(380px,92vw)", background: "rgba(10,14,34,.92)", backdropFilter: "blur(16px)", border: "1px solid rgba(120,200,255,.28)", borderRadius: 20, padding: 26, boxShadow: "0 30px 80px #000a", color: "var(--ink)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={40} height={40} style={{ borderRadius: 12 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>双创AI星际</div>
            <div style={{ fontSize: 10.5, color: "var(--mut)", letterSpacing: 1 }}>DOUBLE INNOVATION AI COSMOS</div>
          </div>
          <button type="button" onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--mut)", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>✕</button>
        </div>
        <p style={{ color: "var(--mut)", fontSize: 13, margin: "10px 0 16px" }}>用学号登录，登录后停留在当前页面</p>

        <label style={{ fontSize: 12, color: "var(--mut)" }}>学号</label>
        <input style={{ ...input, margin: "6px 0 13px" }} value={no} onChange={(e) => setNo(e.target.value)} placeholder="如 202596057038 或 admin" autoComplete="username" />
        <label style={{ fontSize: 12, color: "var(--mut)" }}>密码</label>
        <input style={{ ...input, margin: "6px 0 4px" }} type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="密码" autoComplete="current-password" />

        {err && <div style={{ color: "#ff7a8a", fontSize: 13, marginTop: 11 }}>{err}</div>}

        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 11, border: "none", cursor: loading ? "default" : "pointer", fontWeight: 800, fontSize: 15, color: "#05060f", background: `linear-gradient(120deg,${accent},var(--violet))`, opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
          {loading ? "登录中…" : "登录 →"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px" }}>
          <span style={{ flex: 1, height: 1, background: "rgba(120,200,255,.18)" }} />
          <span style={{ fontSize: 11.5, color: "var(--mut)" }}>或</span>
          <span style={{ flex: 1, height: 1, background: "rgba(120,200,255,.18)" }} />
        </div>
        <button type="button" onClick={ssoLogin} disabled={!!sso || loading}
          style={{ width: "100%", padding: "11px 0", borderRadius: 11, border: "1px solid rgba(52,211,153,.5)", cursor: (sso || loading) ? "default" : "pointer", fontWeight: 700, fontSize: 14, color: "#bdf3dc", background: "rgba(52,211,153,.12)", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          🎓 {sso === "auth" ? "正在跳转学习通授权…" : sso === "login" ? "授权成功，登录中…" : "用学习通登录"}
          <span style={{ fontSize: 10.5, color: "#ffd9a0", border: "1px solid rgba(255,180,80,.4)", padding: "1px 6px", borderRadius: 999 }}>演示</span>
        </button>

        <div style={{ marginTop: 14, fontSize: 12, color: "var(--mut)", lineHeight: 1.7, borderTop: "1px solid rgba(120,200,255,.18)", paddingTop: 11 }}>
          演示账号：<br />学生 <b style={{ color: "var(--ink)" }}>202596057038</b> / Student@2026<br />管理员 <b style={{ color: "var(--ink)" }}>admin</b> / Admin@2026
        </div>
      </form>
    </div>
  );
}
