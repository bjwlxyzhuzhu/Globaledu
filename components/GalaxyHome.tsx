"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initGalaxy } from "./galaxyEngine";
import BlackHole from "./BlackHole";
import AccountPanel from "./AccountPanel";
import LoginModal from "./LoginModal";
import IntroSequence from "./IntroSequence";
import Tour, { type TourStep } from "./Tour";
import AttachBar from "@/app/AttachBar";
import MicButton from "./MicButton";
import SkillPicker, { resolveActiveSkills, pluginNote } from "./SkillPicker";
import RichMsg from "./ChartBlock";
import LiveWall from "./LiveWall";
import { createClient } from "@/lib/supabase/client";
import { PROVIDERS } from "@/lib/ai/providers";
import { loadToolbox, type Toolbox } from "@/lib/skillsClient";
import { skillInstrAll } from "@/lib/skills";
import type { Att } from "@/lib/attach";

type Msg = { role: "user" | "assistant"; content: string };
type Zone = "learn" | "apply";

/** 两个数字人向导：水系=小闯（蓝/男/冷静），火系=小创（橙/女/热情）。随当前星系切换。 */
const HUMANS: Record<Zone, {
  name: string; role: string; emoji: string; gender: "male" | "female"; img: string;
  ring: string; border: string; glow: string; hover: string; greet: string; system: string;
}> = {
  learn: {
    name: "小闯", role: "闯关向导", emoji: "💧", gender: "male", img: "/human-water.jpg",
    ring: "rgba(34,211,238,.55)", border: "rgba(180,230,255,.65)",
    glow: "0 0 26px rgba(34,211,238,.6),inset 0 0 18px rgba(255,255,255,.25)",
    hover: "我是小闯 💧 冷静如水，点我聊闯关",
    greet: "我是小闯 🚀💧 闯关中心的向导，冷静如水。创赛的政策、流程、选题，问我就好。",
    system: "你叫“小闯”，是“双创AI星际·闯关中心”的向导。性格冷静如水、沉稳理性、条理清晰、惜字如金。请用简洁、冷静、有条理的语气回答大学生创新创业竞赛（创赛）相关问题，少用感叹号。",
  },
  apply: {
    name: "小创", role: "创新向导", emoji: "🔥", gender: "female", img: "/human-fire.jpg",
    ring: "rgba(255,120,60,.6)", border: "rgba(255,190,150,.7)",
    glow: "0 0 26px rgba(255,107,53,.6),inset 0 0 18px rgba(255,220,180,.25)",
    hover: "我是小创 🔥 热情似火，点我聊创新",
    greet: "我是小创 🚀🔥 创新中心的向导，热情似火！想搞点厉害的创意、组队、打磨项目，快来找我！",
    system: "你叫“小创”，是“双创AI星际·创新中心”的向导。性格热情似火、活力四射、富有感染力、鼓励创新。请用热情、积极、有感染力的语气回答大学生创新创业（双创）相关问题，多给鼓励和创意。",
  },
};

const HOME_STEPS: TourStep[] = [
  { badge: "🚀", title: "欢迎来到双创AI星际", body: "30 秒带你看懂怎么玩——跟着 ①②③④⑤ 点下去就行。" },
  { sel: "#starLearn", badge: "①", title: "水系 · 闯关中心 💧", body: "「学创赛」的地方：政策解读、选题诊断、案例 & 模板宝库、理论知识、模拟答辩。点这颗蓝色星球进入。" },
  { sel: "#starApply", badge: "②", title: "火系 · 创新中心 🔥", body: "「搞项目」的地方：组队、打磨创意、找资源。点这颗橙色星球切换 / 进入。" },
  { sel: "#blackhole", badge: "③", title: "宇宙黑洞 · 创业星舰 🕳️", body: "两区都能看到的黑洞——平台王牌！点进去就是「驾驶舱」：一队专家 AI 搭子（智能体集群）协同作战，帮你从 0 完成一整套商业计划书 + 路演 PPT。" },
  { sel: "#human", badge: "④", title: "AI 向导随时问", body: "点右下角数字人对话——水系是小闯、火系是小创，随星球切换。创赛任何问题都能问，还能传附件、语音输入。" },
  { sel: "#avBtn", badge: "⑤", title: "登录 · 账户中心", body: "登录后有积分、可绑定自己的大模型 Key、进技能商店；每天登录还送 30 积分。" },
];

/**
 * 首页「银河探索」——设计定稿移植为 React 客户端组件。
 * 结构在 JSX 中渲染；命令式动效（银河 Canvas、双子星、行星轨道、彗星、中英切换、头像）
 * 由 galaxyEngine.initGalaxy() 接管。积分显示与「小航」对话（扣积分示例）用 React state 控制。
 */
export default function GalaxyHome({
  initialCredits = null,
  loggedIn = false,
  userName = null,
  studentNo = null,
  role = null,
}: {
  initialCredits?: number | null;
  loggedIn?: boolean;
  userName?: string | null;
  studentNo?: string | null;
  role?: string | null;
}) {
  const [credits, setCredits] = useState<number | null>(initialCredits);
  const [chatOpen, setChatOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [intro, setIntro] = useState(true);
  const [zone, setZone] = useState<Zone>("learn");
  const persona = HUMANS[zone];
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: HUMANS.learn.greet },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [atts, setAtts] = useState<Att[]>([]);
  const [ownChat, setOwnChat] = useState<{ short: string } | null>(null); // 学生在账户中心绑定的「对话」Key（有则自带额度·不扣积分）
  const [toolbox, setToolbox] = useState<Toolbox | null>(null);
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([]);
  const [activePluginIds, setActivePluginIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const cleanup = initGalaxy();
    return cleanup;
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [msgs, chatOpen]);

  // 关闭对话框时停止正在播放的语音
  useEffect(() => {
    if (!chatOpen) {
      try { audioRef.current?.pause(); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
    }
  }, [chatOpen]);

  // 监听引擎切换星系（#starApply 加 .active = 火系），同步当前数字人（不改引擎）
  useEffect(() => {
    const a = document.getElementById("starApply");
    const l = document.getElementById("starLearn");
    if (!a || !l) return;
    const update = () => setZone(a.classList.contains("active") ? "apply" : "learn");
    update();
    const mo = new MutationObserver(update);
    mo.observe(a, { attributes: true, attributeFilter: ["class"] });
    mo.observe(l, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // 切换星系时，若还没开始聊天（只有问候语），把问候语换成当前向导的
  useEffect(() => {
    setMsgs((m) => (m.length <= 1 ? [{ role: "assistant", content: HUMANS[zone].greet }] : m));
  }, [zone]);

  // 预热语音列表（首次 getVoices() 常为空，需等 voiceschanged 后才有神经音色可选）
  useEffect(() => {
    try {
      const s = window.speechSynthesis;
      if (!s) return;
      s.getVoices();
      const h = () => { /* 触发缓存即可 */ };
      s.addEventListener?.("voiceschanged", h);
      return () => s.removeEventListener?.("voiceschanged", h);
    } catch { /* ignore */ }
  }, []);

  // 检测学生是否绑定了「对话」自有 Key → 聊天框显示「🔑 用我的 Key·不扣积分」
  useEffect(() => {
    if (!loggedIn) { setOwnChat(null); return; }
    (async () => {
      try {
        const supabase = createClient();
        const { data: u } = await supabase.auth.getSession();
        const uId = u.session?.user?.id;
        if (!uId) return;
        const { data } = await supabase.from("user_api_keys").select("provider, model").eq("user_id", uId).eq("purpose", "chat").maybeSingle();
        if (data) setOwnChat({ short: PROVIDERS.find((p) => p.id === data.provider)?.short || data.model || "我的模型" });
      } catch { /* 无绑定 → 用平台默认 */ }
    })();
  }, [loggedIn]);

  // 加载技能工具箱（本地存储，无需登录）
  useEffect(() => { loadToolbox().then(setToolbox); }, []);

  // 选最自然的中文嗓音：优先「神经网络/Online/Natural/Google」音色，并按性别贴合人设（小闯=沉稳男 / 小创=明快女）。
  function pickVoice(gender: "male" | "female"): SpeechSynthesisVoice | null {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const zh = synth.getVoices().filter((v) => /zh|cmn|chinese|中文|普通话/i.test(`${v.lang} ${v.name}`));
    if (!zh.length) return null;
    const femaleN = /xiaoxiao|xiaoyi|xiaomeng|xiaohan|xiaorui|cherry|huihui|yaoyao|female|女/i;
    const maleN = /yunxi|yunyang|yunjian|yunye|kangkang|ethan|male|男/i;
    const isNeural = (v: SpeechSynthesisVoice) => /natural|neural|online|google/i.test(v.name);
    const want = gender === "male" ? maleN : femaleN;
    const other = gender === "male" ? femaleN : maleN;
    return (
      zh.find((v) => isNeural(v) && want.test(v.name)) ||      // 1) 神经音色 + 目标性别（最佳）
      zh.find((v) => isNeural(v) && !other.test(v.name)) ||    // 2) 神经音色 + 非反性别
      zh.find((v) => want.test(v.name)) ||                     // 3) 任意目标性别
      zh.find((v) => isNeural(v)) ||                           // 4) 任意神经中文音色
      zh[0] || null                                            // 5) 兜底
    );
  }

  // 数字人发声：本地有高质量神经音色就直接用（自然·即时·免费）；否则走服务端 TTS，再不行回退基础浏览器音色。一定有声。
  async function speak(text: string, gender: "male" | "female" = "female") {
    if (!text) return;
    const v = pickVoice(gender);
    const neural = !!v && /natural|neural|online|google/i.test(v.name);
    const browserTTS = () => {
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-CN";
        if (v) u.voice = v;
        // 人设化韵律：小创(女·热情)更明快上扬；小闯(男·冷静)更沉稳。神经音色本身自然，pitch 不宜大改，避免“变声”。
        if (gender === "male") { u.rate = neural ? 1.0 : 0.98; u.pitch = neural ? 0.97 : 0.9; }
        else { u.rate = neural ? 1.06 : 1.04; u.pitch = neural ? 1.03 : 1.1; }
        synth.cancel();
        synth.speak(u);
      } catch { /* ignore */ }
    };
    try { audioRef.current?.pause(); } catch { /* ignore */ }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    if (neural) { browserTTS(); return; } // 本地神经音色优先，免调用服务端、不耗积分
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, gender }),
      });
      if (!res.ok) { browserTTS(); return; }
      const blob = await res.blob();
      if (!blob.size) { browserTTS(); return; }
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => URL.revokeObjectURL(url);
      await a.play().catch(() => { URL.revokeObjectURL(url); browserTTS(); });
    } catch {
      browserTTS();
    }
  }

  async function send() {
    const q = input.trim() || (atts.length ? "请结合附件帮我分析。" : "");
    if (!q || sending) return;
    const shown = q + (atts.length ? `　📎 ${atts.map((a) => a.name).join("、")}` : "");
    const next: Msg[] = [...msgs, { role: "user", content: shown }];
    setMsgs(next);
    setInput("");
    const sentAtts = atts;
    setAtts([]);
    setSending(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-8), system: persona.system + skillInstrAll(resolveActiveSkills(toolbox, activeSkillIds)) + pluginNote(activePluginIds), attachments: sentAtts, plugins: activePluginIds }),
      });
      const data = await res.json().catch(() => ({}));
      let reply: string;
      let speakText = "";
      if (res.status === 401) reply = "请先登录后再用我哦（右上角 → 登录）。";
      else if (res.status === 402) reply = "积分不足啦～联系管理员补充，或填入你的 API Key。";
      else if (!res.ok) reply = "出错了：" + (data.error || res.status);
      else {
        const t = data.text || "(空回复)";
        speakText = t; // 语音只念正文，不念「参考」
        const srcs: { title?: string; source?: string }[] = Array.isArray(data.sources) ? data.sources : [];
        const names = [...new Set(srcs.map((s) => s.title || s.source).filter(Boolean))].slice(0, 3);
        reply = names.length ? `${t}\n\n📚 参考：${names.join("、")}` : t;
        if (typeof data.remaining === "number") setCredits(data.remaining);
      }
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
      if (speakOn && speakText) speak(speakText, persona.gender);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "网络错误，请确认能访问 APIMart。" }]);
    }
    setSending(false);
  }

  return (
    <>
      <div className="deep" />
      <div className="neb n1" />
      <div className="neb n2" />
      <div className="neb n3" />
      <canvas id="galaxy" />
      <LiveWall />

      <div className="wrap">
        <nav>
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="双创AI星际" onError={(e) => e.currentTarget.remove()} />
            双创
          </div>
          <div className="brand">
            <b>双创AI星际</b>
            <small>DOUBLE INNOVATION AI COSMOS</small>
          </div>
          <div className="spacer" />
          <a href="/me/growth" className="chip" title="成长星图 · 你的能力成长证据链" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 700 }}>🌌 成长星图</a>
          <a href="/apply/skills" className="chip" title="技能商店 · 浏览 / 安装 / 沉淀技能" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 700 }}>🛒 技能商店</a>
          <button className="chip langbtn" id="langBtn" title="切换语言 / Switch language">
            🌐 <span id="langTxt">EN</span>
          </button>
          <span className="chip">
            <span className="dot" />
            <span id="creditsLbl">积分</span>{" "}
            {loggedIn ? (
              <b style={{ color: "var(--ink)" }}>{credits ?? "…"}</b>
            ) : (
              <button onClick={() => setLoginOpen(true)} style={{ color: "var(--cyan)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", padding: 0 }}>
                登录
              </button>
            )}
          </span>
          <div
            className="av"
            id="avBtn"
            title="账户中心"
            onClick={() => {
              if (loggedIn) setAccountOpen(true);
              else setLoginOpen(true);
            }}
          >
            <span id="avShow">🐼</span>
          </div>
        </nav>

        <header>
          <span className="tag" />
          <h1 />
          <p className="sub" />
        </header>

        <div className="zonecap" id="zc" />

        <div className="solar" id="solar">
          <div className="orbits" />
          <div className="starwrap active" id="starLearn">
            <div className="btip" />
            <div className="bigsphere" id="sphereLearn">
              <div className="bsurf" />
              <span className="bsanim">🐼</span>
            </div>
          </div>
          <div className="starwrap" id="starApply">
            <div className="btip" />
            <div className="bigsphere" id="sphereApply">
              <div className="bsurf" />
              <span className="bsanim">🐯</span>
            </div>
          </div>
        </div>

        <footer />
        {/* 宇宙黑洞「创业星舰」入口：两区常驻、吞噬星体、点击坠入驾驶舱 */}
        <BlackHole onEnter={() => router.push("/apply/cockpit")} />
      </div>

      <div
        className="human"
        id="human"
        title={`${persona.name} · ${persona.role}（点我对话）`}
        onClick={() => setChatOpen((v) => !v)}
      >
        <div className="hbubble">{persona.hover}</div>
        <div
          className="hring"
          style={{ borderColor: persona.ring, borderTopColor: "transparent", borderLeftColor: "transparent" }}
        />
        <div className="helmet" style={{ borderColor: persona.border, boxShadow: persona.glow }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={persona.img} alt={persona.name} />
          <div className="visor" />
        </div>
      </div>

      {/* 小航对话（扣积分示例） */}
      {chatOpen && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 142,
            width: "min(340px, 92vw)",
            height: 440,
            zIndex: 70,
            display: "flex",
            flexDirection: "column",
            background: "rgba(10,14,34,.92)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            boxShadow: "0 24px 60px #000a",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
            }}
          >
            {persona.emoji} {persona.name} · AI 向导
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--mut)" }}>
              {loggedIn ? `积分 ${credits ?? "…"}` : "未登录"}
            </span>
            <button
              onClick={() =>
                setSpeakOn((v) => {
                  const nv = !v;
                  if (!nv) {
                    try { audioRef.current?.pause(); } catch {}
                    try { window.speechSynthesis?.cancel(); } catch {}
                  }
                  return nv;
                })
              }
              title={speakOn ? "数字人语音：开（点击静音）" : "数字人语音：关（点击开启）"}
              style={{
                background: "none",
                border: "none",
                color: speakOn ? "var(--cyan)" : "var(--mut)",
                cursor: "pointer",
                fontSize: 16,
                fontFamily: "inherit",
              }}
            >
              {speakOn ? "🔊" : "🔇"}
            </button>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--mut)",
                cursor: "pointer",
                fontSize: 18,
                fontFamily: "inherit",
              }}
            >
              ×
            </button>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  padding: "9px 12px",
                  borderRadius: 13,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  color: m.role === "user" ? "#05060f" : "var(--ink)",
                  background:
                    m.role === "user"
                      ? "linear-gradient(120deg,var(--cyan),var(--violet))"
                      : "rgba(255,255,255,.06)",
                  border: m.role === "user" ? "none" : "1px solid var(--line)",
                }}
              >
                {m.role === "assistant" ? <RichMsg text={m.content} /> : m.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: "flex-start", fontSize: 13, color: "var(--mut)" }}>小航思考中…</div>
            )}
          </div>

          {loggedIn && (
            <div style={{ padding: "0 12px 8px" }}>
              <AttachBar atts={atts} setAtts={setAtts} accent="var(--cyan)" />
            </div>
          )}
          {ownChat && (
            <div style={{ padding: "0 12px 6px", fontSize: 11, color: "#34d399", display: "flex", alignItems: "center", gap: 5 }}>
              🔑 正在用我的 {ownChat.short} · 自带 Key 不扣积分
            </div>
          )}
          {loggedIn && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px 8px" }}>
              <SkillPicker toolbox={toolbox}
                activeSkillIds={activeSkillIds} onToggleSkill={(id) => setActiveSkillIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id])}
                activePluginIds={activePluginIds} onTogglePlugin={(id) => setActivePluginIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id])}
                accent="var(--cyan)" />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={loggedIn ? "问点创赛的问题…" : "登录后可用"}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 11,
                border: "1px solid var(--line)",
                background: "rgba(255,255,255,.04)",
                color: "var(--ink)",
                fontSize: 14,
                outline: "none",
              }}
            />
            {loggedIn && <MicButton onText={(t) => setInput((v) => (v ? v + " " : "") + t)} accent="var(--cyan)" title="语音输入：点麦克风说话，自动转文字" />}
            <button
              onClick={send}
              disabled={sending}
              style={{
                padding: "0 16px",
                borderRadius: 11,
                border: "none",
                cursor: sending ? "default" : "pointer",
                fontWeight: 700,
                color: "#05060f",
                background: "linear-gradient(120deg,var(--cyan),var(--violet))",
                fontFamily: "inherit",
              }}
            >
              发送
            </button>
          </div>
        </div>
      )}

      <canvas id="fx" />

      <div className="detail" id="detail">
        <div className="dwrap">
          <div className="dglobe" id="dg" />
          <h2 id="dt" />
          <p id="dd" />
          <div className="dnote" id="dnote" />
          <button
            onClick={() => {
              const m = (window as unknown as { __module?: { key: string; name: string; live: boolean; zone?: number } }).__module;
              if (!m) return;
              if (m.live && m.key) router.push((m.zone === 1 ? "/apply/" : "/learn/") + m.key);
              else alert(`「${m.name}」即将上线，敬请期待 🚧`);
            }}
            style={{
              marginTop: 14, padding: "11px 26px", borderRadius: 12, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 800, fontSize: 14, color: "#05060f",
              background: "linear-gradient(120deg,var(--cyan),var(--violet))", boxShadow: "0 8px 24px rgba(34,211,238,.3)",
            }}
          >
            进入模块 →
          </button>
          <button className="dback" />
        </div>
      </div>

      <div className="avpanel" id="avPanel">
        <div className="avbox">
          <h3 />
          <p />
          <div className="avgrid" id="avGrid" />
          <div className="avrow">
            <label htmlFor="avFile" />
            <input type="file" id="avFile" accept="image/*" />
            <button className="close" />
          </div>
        </div>
      </div>

      <AccountPanel
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        profile={{ name: userName, studentNo, role, credits }}
      />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      {intro && <IntroSequence onDone={() => setIntro(false)} />}
      <Tour active={!intro} seenKey="home_tour_v3" steps={HOME_STEPS} />
    </>
  );
}
