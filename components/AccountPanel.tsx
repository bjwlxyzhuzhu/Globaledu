"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PROVIDERS, PURPOSES, providersFor, type Purpose } from "@/lib/ai/providers";
import ModelSelect from "./ModelSelect";

type Profile = {
  name?: string | null;
  studentNo?: string | null;
  role?: string | null;
  credits?: number | null;
};
type KeyForm = { provider: string; base_url: string; api_key: string; model: string; saved: boolean };
type Usage = { action: string; cost: number; created_at: string };

const ACTION_LABEL: Record<string, string> = {
  chat: "对话", topic: "选题", text: "文本生成", ppt: "PPT", image: "配图", defense: "答辩", data: "数据分析",
};

const emptyKey = (): KeyForm => ({ provider: "", base_url: "", api_key: "", model: "", saved: false });

export default function AccountPanel({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"account" | "keys" | "bill">("account");
  const [keys, setKeys] = useState<Record<Purpose, KeyForm>>({
    chat: emptyKey(), reason: emptyKey(), text: emptyKey(), image: emptyKey(), tts: emptyKey(),
  });
  const [usage, setUsage] = useState<Usage[]>([]);
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [adv, setAdv] = useState<Record<Purpose, boolean>>({ chat: false, reason: false, text: false, image: false, tts: false });

  useEffect(() => {
    if (!open) return;
    setMsg("");
    const supabase = createClient();
    supabase
      .from("user_api_keys")
      .select("purpose, provider, base_url, api_key, model")
      .then(({ data }) => {
        if (!data) return;
        setKeys((prev) => {
          const next = { ...prev };
          for (const r of data as { purpose: Purpose; provider: string; base_url: string; api_key: string; model: string }[]) {
            if (next[r.purpose] !== undefined)
              next[r.purpose] = { provider: r.provider || "", base_url: r.base_url || "", api_key: r.api_key || "", model: r.model || "", saved: true };
          }
          return next;
        });
      });
    supabase
      .from("usage_logs")
      .select("action, cost, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setUsage((data as Usage[]) || []));
  }, [open]);

  if (!open) return null;

  function setKey(p: Purpose, patch: Partial<KeyForm>) {
    setKeys((k) => ({ ...k, [p]: { ...k[p], ...patch } }));
  }
  function pickProvider(p: Purpose, id: string) {
    const prov = PROVIDERS.find((x) => x.id === id);
    setKey(p, { provider: id, base_url: prov?.baseUrl || "", model: prov?.models[p] || "" });
  }

  async function saveKey(p: Purpose) {
    setBusy(true); setMsg("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMsg("未登录"); setBusy(false); return; }
    const k = keys[p];
    const { error } = await supabase.from("user_api_keys").upsert({
      user_id: user.id, purpose: p, provider: k.provider, base_url: k.base_url, api_key: k.api_key, model: k.model,
    });
    setBusy(false);
    if (error) setMsg("保存失败：" + error.message);
    else { setKey(p, { saved: true }); setMsg(`已保存「${PURPOSES.find((x) => x.key === p)?.label}」的 API Key（将用你自己的额度，不扣积分）`); }
  }
  async function clearKey(p: Purpose) {
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("user_api_keys").delete().eq("user_id", user.id).eq("purpose", p);
    setKeys((k) => ({ ...k, [p]: emptyKey() }));
    setBusy(false); setMsg("已清除，恢复为平台默认（扣积分）");
  }
  async function changePwd() {
    if (pwd.length < 6) { setMsg("密码至少 6 位"); return; }
    setBusy(true); setMsg("");
    const { error } = await createClient().auth.updateUser({ password: pwd });
    setBusy(false);
    setMsg(error ? "改密失败：" + error.message : "密码已修改 ✓");
    if (!error) setPwd("");
  }
  async function logout() {
    await createClient().auth.signOut();
    onClose();
    router.push("/");
    router.refresh();
  }

  const totalCost = usage.reduce((s, u) => s + (u.cost || 0), 0);
  const inputCss: React.CSSProperties = {
    width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid var(--line)",
    background: "rgba(255,255,255,.04)", color: "var(--ink)", fontSize: 13, outline: "none", fontFamily: "inherit",
  };
  const btn = (bg: string): React.CSSProperties => ({
    padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700,
    fontSize: 13, color: "#05060f", background: bg, fontFamily: "inherit",
  });

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 97, display: "grid", placeItems: "center",
        background: "rgba(5,6,18,.78)", backdropFilter: "blur(14px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 94vw)", maxHeight: "88vh", display: "flex", flexDirection: "column",
          background: "rgba(10,14,34,.96)", border: "1px solid var(--line)", borderRadius: 22,
          boxShadow: "0 30px 80px #000a", overflow: "hidden" }}
      >
        {/* 头部 */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center",
            fontSize: 26, background: "linear-gradient(135deg,#34507a,#22d3ee)" }}>👤</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{profile.name || "用户"}</div>
            <div style={{ fontSize: 12, color: "var(--mut)" }}>
              学号 {profile.studentNo || "—"} ·{" "}
              <span style={{ color: profile.role === "admin" || profile.role === "teacher" ? "#f5a623" : "var(--cyan)" }}>
                {profile.role === "admin" ? "管理员" : profile.role === "teacher" ? "教师" : "学生"}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--mut)" }}>积分</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "var(--cyan)" }}>{profile.credits ?? "—"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--mut)", cursor: "pointer", fontSize: 22, fontFamily: "inherit" }}>×</button>
        </div>

        {/* Tab */}
        <div style={{ display: "flex", gap: 4, padding: "10px 16px 0" }}>
          {([["account", "账号"], ["keys", "API Key"], ["bill", "积分账单"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setMsg(""); }}
              style={{ padding: "8px 14px", borderRadius: "10px 10px 0 0", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontWeight: 700, fontSize: 13, color: tab === k ? "var(--ink)" : "var(--mut)",
                background: tab === k ? "rgba(255,255,255,.06)" : "transparent" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {msg && <div style={{ marginBottom: 12, fontSize: 12.5, color: "#7ee0a0", background: "rgba(94,224,160,.1)", border: "1px solid rgba(94,224,160,.3)", borderRadius: 10, padding: "9px 12px" }}>{msg}</div>}

          {/* 账号 */}
          {tab === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>头像</div>
                <button onClick={() => (window as unknown as { __openAvatarPicker?: () => void }).__openAvatarPicker?.()} style={btn("rgba(255,255,255,.08)")}>
                  🐼 更换星际头像
                </button>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>修改密码</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="新密码（≥6 位）" style={inputCss} />
                  <button onClick={changePwd} disabled={busy} style={btn("linear-gradient(120deg,var(--cyan),var(--violet))")}>保存</button>
                </div>
              </div>
              {["admin", "teacher"].includes(profile.role || "") && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>管理端</div>
                  <button onClick={() => { onClose(); router.push("/admin"); }} style={btn("rgba(34,211,238,.14)")}>
                    🛠 进入管理端 · 名册导入 / 学生 / 知识库 / 用量
                  </button>
                </div>
              )}
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <button onClick={logout} style={{ ...btn("rgba(255,80,90,.16)"), color: "#ff8a96", border: "1px solid rgba(255,80,90,.4)" }}>
                  退出登录
                </button>
                <div style={{ marginTop: 12, textAlign: "center" }}>
                  <a href="/compliance" onClick={onClose} style={{ fontSize: 12, color: "var(--mut)", textDecoration: "none" }}>合规与隐私说明 ↗</a>
                </div>
              </div>
            </div>
          )}

          {/* API Key */}
          {tab === "keys" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 12, color: "var(--mut)", lineHeight: 1.7 }}>
                为各智能体分别绑定<b style={{ color: "var(--ink)" }}>国内大模型</b>（配图可另选 GPT Image 2）。<b style={{ color: "var(--cyan)" }}>协议已写好</b>，你只需<b style={{ color: "var(--ink)" }}>选模型 + 粘贴 API Key</b>。<br />
                <b style={{ color: "var(--ink)" }}>留空</b> = 用平台默认并扣积分；<b style={{ color: "var(--cyan)" }}>填了</b> = 用你自己额度、<b style={{ color: "var(--cyan)" }}>不扣积分</b>。
              </div>
              {PURPOSES.map(({ key, icon, label, agent, desc }) => {
                const k = keys[key];
                const g = providersFor(key);
                const cnNames = g.cn.map((p) => p.short).join(" · ");
                const intlNames = g.intl.map((p) => p.short).join(" · ");
                const mkOpt = (p: (typeof PROVIDERS)[number]) => ({ value: p.id, label: p.short });
                const modelGroups = [
                  { label: "🇨🇳 国内大模型", options: g.cn.map(mkOpt) },
                  { label: "🌍 国外大模型", options: g.intl.map(mkOpt) },
                ];
                return (
                  <div key={key} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 14, background: "rgba(255,255,255,.025)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                      <span style={{ fontSize: 19 }}>{icon}</span>
                      <span style={{ fontWeight: 800, fontSize: 14.5 }}>{label}</span>
                      {k.saved
                        ? <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--cyan)" }}>● 已绑定</span>
                        : <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut)" }}>未绑定 · 用平台默认</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 8, paddingLeft: 28 }}>
                      {agent}　|　{desc}
                    </div>
                    <div style={{ fontSize: 11.5, lineHeight: 1.7, marginBottom: 10, padding: "8px 10px", borderRadius: 9, background: "rgba(34,211,238,.06)", border: "1px solid rgba(34,211,238,.16)" }}>
                      <span style={{ color: "var(--mut)" }}>可对接：</span>
                      {cnNames && <span>🇨🇳 {cnNames}</span>}
                      {cnNames && intlNames && <span style={{ color: "var(--mut)" }}>　｜　</span>}
                      {intlNames && <span>🌍 {intlNames}</span>}
                    </div>

                    <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 5 }}>① 选择要对接的模型</div>
                    <ModelSelect value={k.provider} onChange={(id) => pickProvider(key, id)} groups={modelGroups} placeholder="选择模型…（自动写好协议）" />

                    <div style={{ fontSize: 11.5, color: "var(--mut)", margin: "10px 0 5px" }}>② 粘贴该模型的 API Key（只需填这一项）</div>
                    <input type="password" value={k.api_key} onChange={(e) => setKey(key, { api_key: e.target.value })}
                      placeholder="🔑 API Key（如 sk-...）"
                      style={{ ...inputCss, border: "1px solid rgba(34,211,238,.5)", background: "rgba(34,211,238,.05)" }} />

                    <button onClick={() => setAdv((a) => ({ ...a, [key]: !a[key] }))}
                      style={{ marginTop: 9, background: "none", border: "none", color: "var(--mut)", cursor: "pointer", fontSize: 11.5, fontFamily: "inherit", padding: 0 }}>
                      {adv[key] ? "▾" : "▸"} 协议详情（已自动填好，可改）
                    </button>
                    {adv[key] && (
                      <div style={{ marginTop: 8 }}>
                        <input value={k.base_url} onChange={(e) => setKey(key, { base_url: e.target.value })} placeholder="Base URL（OpenAI 兼容接口）" style={inputCss} />
                        <input value={k.model} onChange={(e) => setKey(key, { model: e.target.value })} placeholder="模型名 model" style={{ ...inputCss, marginTop: 8 }} />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => saveKey(key)} disabled={busy || !k.api_key || !k.base_url} style={btn("linear-gradient(120deg,var(--cyan),var(--violet))")}>保存</button>
                      {k.saved && <button onClick={() => clearKey(key)} disabled={busy} style={{ ...btn("rgba(255,255,255,.06)"), color: "var(--mut)" }}>清除</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 积分账单 */}
          {tab === "bill" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13 }}>
                <span style={{ color: "var(--mut)" }}>近 50 条消耗记录</span>
                <span>累计消耗 <b style={{ color: "var(--cyan)" }}>{totalCost}</b> 分</span>
              </div>
              {usage.length === 0 ? (
                <div style={{ color: "var(--mut)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>暂无消耗记录</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                  {usage.map((u, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: "rgba(255,255,255,.02)", fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{ACTION_LABEL[u.action] || u.action}</span>
                      <span style={{ flex: 1, color: "var(--mut)", fontSize: 11.5 }}>
                        {new Date(u.created_at).toLocaleString("zh-CN", { hour12: false })}
                      </span>
                      <span style={{ color: "#ff9f8a" }}>-{u.cost}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
