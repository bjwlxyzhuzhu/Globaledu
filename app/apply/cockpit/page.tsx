"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import WarpStarfield from "@/components/WarpStarfield";
import AccountButton from "@/components/AccountButton";
import CrewStage, { StageStatus, StageAgent, Flight, ScreenItem } from "@/components/CrewStage";
import CockpitIntro from "@/components/CockpitIntro";
import Tour, { type TourStep } from "@/components/Tour";
import CloudProjects, { CloudProject } from "@/components/CloudProjects";
import AttachBar from "../../AttachBar";
import MicButton from "@/components/MicButton";
import ModelSelect from "@/components/ModelSelect";
import SkillPicker, { resolveActiveSkills, pluginNote } from "@/components/SkillPicker";
import { loadToolbox, type Toolbox } from "@/lib/skillsClient";
import { skillInstr } from "@/lib/skills";
import type { Att } from "@/lib/attach";
import { CREW, CREW_BY_KEY } from "@/lib/crew";
import { PROVIDERS } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/client";
import { downloadWord, printPdf, downloadPptx } from "@/lib/download";
import { logClientEvidence } from "@/lib/evidenceClient";

const LS = "crew_project_v1";
const THEME_LS = "cockpit_theme";
const TEAM_LS = "cockpit_team_v1";
const INTRO_SS = "cockpit_intro_seen";
const MAJOR = "通用";
const TASKMAP: Record<string, string> = {
  strategy: "战略规划与深度调研", design: "产品设计与体验", teacher: "技术方案与开发",
  student: "商业模式与商业咨询", industry: "产业落地与市场打法", mentor: "育人成长与教育价值",
  advisor: "材料撰写与规范化", boss: "统筹与汇总",
};
// 平台内置大模型（DeepSeek 国内直连，免外网·白嫖·仅扣积分）。DeepSeek V4 为平台默认。
// 学生若在账户中心绑定了自己的 Key，下拉会自动换成「🔑 我的模型」（见组件内 modelOpts）。
const PLATFORM_MODELS = [
  { v: "", label: "DeepSeek V4 · 平台默认" },
  { v: "deepseek-reasoner", label: "DeepSeek 深度思考(R1)" },
];

// 驾驶舱新手引导步骤
const COCKPIT_STEPS: TourStep[] = [
  { sel: "#ck-deck", badge: "①", title: "专家智能体集群", body: "这是作战甲板——一队专家 AI 搭子（战略 / 产品 / 技术 / 商业 / 产业 / 育人 / 材料…）在各自工位协同，由功夫熊猫总负责统筹调度。" },
  { sel: "#ck-fan", badge: "②", title: "按需增删搭子", body: "右侧轮盘可加入更多专家搭子（熊猫总负责 + 材料撰写固定保留）；甲板上点搭子可移出。工作流会按所选自动编排、材料撰写恒在最后打包。" },
  { sel: "#ck-goal", badge: "③", title: "说出你的目标", body: "在这里写项目名和目标，把活交给功夫熊猫。例：帮我打磨成一份能参赛的完整商业计划书，重点写清商业模式和技术壁垒。" },
  { sel: "#ck-tools", badge: "④", title: "模型 · 篇幅 · 技能 · 语音", body: "选大模型与成稿篇幅；点「🧩 技能」加载技能、「🎤」语音输入。下方还能进「🛒 技能商店」装更多技能、用「☁ 我的项目」云端存取。" },
  { sel: "#ck-start", badge: "⑤", title: "一键开始协作", body: "点这里，智能体集群开始协同作战，自动产出一整套商业计划书；完成后可「查看 / 导出成稿」为 Word / PDF / 路演 PPT。" },
];
// 成稿字数区间（匹配 DeepSeek 长文本输出，mt=该轮 max_tokens 上限，sec=各分节字数）
const LEN_OPTS = [
  { v: "精简", total: "约 1500–2500 字", sec: "300–500", mt: 3000 },
  { v: "标准", total: "约 3500–5000 字", sec: "500–800", mt: 5200 },
  { v: "详尽", total: "约 6000–8000 字", sec: "800–1200", mt: 8000 },
  { v: "完整", total: "约 9000–12000 字", sec: "1000–1600", mt: 8192 },
];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 工作流相位（数字越小越靠前）：调研→市场→商业→产品→技术→育人，材料撰写恒最后(打包成稿)。
// 总负责(boss)不参与排序——它在最前制定计划、最后终审。
const PHASE: Record<string, number> = { strategy: 1, industry: 2, student: 3, design: 4, teacher: 5, mentor: 6, advisor: 9, boss: 0 };
const byPhase = (a: string, b: string) => (PHASE[a] ?? 50) - (PHASE[b] ?? 50);

/** 团队 + 老大 → 舞台坐标（百分比）。指挥中心式：大屏在上，操作员沿底部一排；总负责坐居中、显著上移的主席台。 */
function layout(team: string[], leader: string, full = false): Record<string, { x: number; y: number }> {
  void full;
  const ws = team.filter((k) => k !== leader).sort(byPhase);
  const n = ws.length;
  const pos: Record<string, { x: number; y: number }> = {};
  ws.forEach((k, i) => {
    const x = n <= 1 ? 50 : 8 + (84 * i) / (n - 1);
    const y = 80 - (i % 2 ? 6 : 0); // 错位改为「向上」(80/74%)，避免奇数位太靠底致状态标签被甲板裁切
    pos[k] = { x, y };
  });
  pos[leader] = { x: 50, y: 60 }; // 主席台：居中、显著上移
  return pos;
}

function Ball({ k, emoji, color, size }: { k: string; emoji: string; color: string; size: number }) {
  const [e, setE] = useState(false);
  if (e) return <div style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: size * 0.5, background: `radial-gradient(circle at 38% 32%, ${color}55, ${color}1a 70%, rgba(7,9,26,.5))` }}>{emoji}</div>;
  return <img src={`/crew/${k}.png`} alt="" onError={() => setE(true)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
}

type Mode = "setup" | "confirm" | "run";

export default function CockpitPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [goal, setGoal] = useState("");
  const [team, setTeam] = useState<string[]>(["boss", "strategy", "teacher", "student", "advisor"]);
  const [leader, setLeader] = useState("boss");
  const [mode, setMode] = useState<Mode>("setup");
  const [stage, setStage] = useState<Record<string, StageStatus>>({});
  const [flights, setFlights] = useState<Flight[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [caption, setCaption] = useState("");
  const [feed, setFeed] = useState<ScreenItem[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [err, setErr] = useState("");
  const [exp, setExp] = useState("");
  const [pptLinks, setPptLinks] = useState<{ downloadUrl?: string; editUrl?: string } | null>(null);
  const [revise, setRevise] = useState("");
  const [revising, setRevising] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [web, setWeb] = useState(false);
  const [model, setModel] = useState("");
  const [ownChat, setOwnChat] = useState<{ short: string; model: string } | null>(null); // 学生在账户中心绑定的「对话」模型（有则自带 Key·不扣积分）
  const [toolbox, setToolbox] = useState<Toolbox | null>(null);
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([]);
  const [activePluginIds, setActivePluginIds] = useState<string[]>([]);
  const [lenKey, setLenKey] = useState("详尽");
  const [hover, setHover] = useState<string | null>(null);
  const [intro, setIntro] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const flightId = useRef(0);

  useEffect(() => { const f = () => setNarrow(window.innerWidth < 720); f(); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);

  useEffect(() => {
    try { const r = localStorage.getItem(LS); if (r) { const p = JSON.parse(r); setName(p.name || ""); setDraft(p.draft || ""); } } catch { /* ignore */ }
    try { const t = localStorage.getItem(THEME_LS); if (t === "light" || t === "dark") setTheme(t); } catch { /* ignore */ }
    try { const tr = localStorage.getItem(TEAM_LS); if (tr) { const p = JSON.parse(tr); const saved = (p.team || []).filter((k: string) => CREW_BY_KEY[k]); const tm = Array.from(new Set<string>(["boss", ...saved, "advisor"])); setTeam(tm); setLeader(tm.includes(p.leader) ? p.leader : "boss"); } } catch { /* ignore */ }
    try { if (typeof window !== "undefined" && !sessionStorage.getItem(INTRO_SS)) setIntro(true); } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(TEAM_LS, JSON.stringify({ team, leader })); } catch { /* ignore */ } }, [team, leader]);
  useEffect(() => { try { const r = localStorage.getItem(LS); const p = r ? JSON.parse(r) : {}; localStorage.setItem(LS, JSON.stringify({ ...p, name, draft })); } catch { /* ignore */ } }, [name, draft]);
  useEffect(() => { try { localStorage.setItem(THEME_LS, theme); } catch { /* ignore */ } }, [theme]);

  // 检测学生是否在账户中心绑定了「对话」用途的自有 Key → 驾驶舱显示「🔑 我的模型」、自动用其额度不扣积分
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: u } = await supabase.auth.getSession();
        const uId = u.session?.user?.id;
        if (!uId) return;
        const { data } = await supabase.from("user_api_keys").select("provider, model").eq("user_id", uId).eq("purpose", "chat").maybeSingle();
        if (data) {
          const short = PROVIDERS.find((p) => p.id === data.provider)?.short || data.model || "我的模型";
          setOwnChat({ short, model: data.model || "" });
          setModel(""); // 默认就用自己的 Key（v="" → 后端 resolveAIClient 优先走自有 Key）
        }
      } catch { /* 未登录/无表/无绑定 → 用平台默认 */ }
    })();
  }, []);

  // 加载技能工具箱（已启用目录技能 + 自有技能 + 已启用插件）
  useEffect(() => { loadToolbox().then(setToolbox); }, []);

  const dark = theme === "dark";
  const T = dark
    ? { ink: "#e8f0ff", mut: "#9fb6e0", sub: "#cfe0ff", panel: "rgba(7,9,26,.66)", line: "rgba(120,200,255,.22)", inBg: "rgba(255,255,255,.06)", inLine: "rgba(120,200,255,.28)", pageBg: "#04030f" }
    : { ink: "#16233c", mut: "#5a6b86", sub: "#27406a", panel: "rgba(255,255,255,.82)", line: "rgba(80,120,200,.28)", inBg: "rgba(255,255,255,.9)", inLine: "rgba(80,120,200,.3)", pageBg: "#e9eefb" };

  function toggleMember(k: string) {
    if (running) return;
    if ((k === "boss" || k === "advisor")) return; // 熊猫(总负责)与材料撰写：恒在团队，不可移除
    setTeam((t) => {
      if (t.includes(k)) { const n = t.filter((x) => x !== k); if (!n.length) return t; if (k === leader) setLeader(n.includes("boss") ? "boss" : n[0]); return n; }
      return [...t, k];
    });
  }

  const pos = layout(team, leader, narrow);
  const agents: StageAgent[] = team.map((k) => {
    const c = CREW_BY_KEY[k];
    return { key: k, name: c.name, title: c.trait, emoji: c.emoji, color: c.color, x: pos[k].x, y: pos[k].y, status: stage[k] || "idle", isLead: k === leader, locked: k === "boss" || k === "advisor" };
  });
  const outAgents = CREW.filter((c) => !team.includes(c.key));

  const workerCount = team.filter((k) => k !== leader).length;
  const estimate = workerCount ? workerCount + 3 : 1;

  const ctx = `项目名：${name || "（未命名）"}。` + (draft ? `\n已有 BP 草案（节选）：\n${draft.slice(0, 1400)}` : " 暂无已沉淀内容。");
  const LEN = LEN_OPTS.find((o) => o.v === lenKey) || LEN_OPTS[2];
  // 绑了自有 Key → 只给「我的模型」一项（v="" 即走自有 Key、不扣积分）；否则给平台模型清单
  const modelOpts = ownChat ? [{ v: "", label: `🔑 我的 ${ownChat.short} · 不扣积分` }] : PLATFORM_MODELS;

  async function ask(system: string, userMsg: string, useWeb = false, maxTokens?: number, evidence?: { kind: string; title?: string; meta?: Record<string, unknown> }): Promise<string> {
    const res = await fetch("/api/ai/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: userMsg }], system, model: model || undefined, web: useWeb, maxTokens, attachments: atts, plugins: activePluginIds, ...(evidence ? { evidence } : {}) }) });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("请先登录后再启动驾驶舱（右上角 → 登录）");
    if (res.status === 402) throw new Error("积分不足，可在账户中心绑定自己的 API Key");
    if (!res.ok) throw new Error(d.error || ("出错 " + res.status));
    return d.text || "";
  }

  async function run() {
    const g = goal.trim();
    if (!g || running) return;
    const P = layout(team, leader, narrow);
    const lead = CREW_BY_KEY[leader];
    const workersAll = team.filter((k) => k !== leader).sort(byPhase).map((k) => CREW_BY_KEY[k]);
    const writer = workersAll.find((w) => w.key === "advisor") || null; // 材料撰写：恒最后打包
    const workers = workersAll.filter((w) => w.key !== "advisor");        // 领域搭子（按相位顺序）
    const active = resolveActiveSkills(toolbox, activeSkillIds);           // 本次激活的技能
    const leadSkills = skillInstr(active, leader) + pluginNote(activePluginIds); // 注入总负责 + 插件声明
    setRunning(true); setDone(false); setErr(""); setDrawer(false); setFlights([]); setFeed([]);
    setStage(Object.fromEntries(team.map((k) => [k, "idle" as StageStatus])));
    setMode("run");
    const sset = (k: string, s: StageStatus) => setStage((p) => ({ ...p, [k]: s }));
    const pushFeed = (who: string, color: string, text: string) => setFeed((f) => [...f, { who, color, text: (text || "").replace(/\s+/g, " ").slice(0, 160) }]);
    const fly = (a: string, b: string, label: string, color: string) => new Promise<void>((res) => {
      const from = P[a], to = P[b]; if (!from || !to) { res(); return; }
      const id = ++flightId.current;
      setFlights((f) => [...f, { id, from, to, label, color }]);
      setTimeout(() => setFlights((f) => f.filter((x) => x.id !== id)), 1250);
      setTimeout(res, 820);
    });
    const collected: Record<string, { name: string; task: string; out: string }> = {};
    try {
      if (workersAll.length) {
        // 总负责制定计划（按工作流顺序点名）
        setCaption(`${lead.name} 正在制定作战计划…`);
        sset(leader, "think");
        const plan = await ask(lead.system(MAJOR) + leadSkills + "\n" + ctx + `\n你是带头的总负责。本次工作流顺序：${workersAll.map((w) => w.name).join(" → ")}（其中「材料撰写」负责最后把全队成果打包成稿）。请用 2-3 句按此顺序点名分工调度，简洁有力。`, g, web);
        pushFeed(lead.name, lead.color, "分工调度 · " + plan);
        sset(leader, "idle");
        // —— 协同接力：领域搭子按相位顺序，彼此把活接力交下去（不每步回报老大）——
        const dn = workers.length;
        if (dn) { setCaption(`${lead.name} 启动协作，把活交给 ${workers[0].name}`); await fly(leader, workers[0].key, "启动·交给你", lead.color); }
        let prior = "";
        for (let i = 0; i < dn; i++) {
          const m = workers[i];
          const task = TASKMAP[m.key] || "贡献你的专长";
          sset(m.key, "think");
          setCaption(`${m.name} 正在${task}…`);
          const peer = prior ? `\n上游队友已产出（请参考、衔接、不要重复）：\n${prior.slice(0, 1200)}` : "";
          const out = await ask(m.system(MAJOR) + skillInstr(active, m.key) + "\n" + ctx + peer + `\n你是协同团队一员（工作流：${workersAll.map((w) => w.name).join("→")}）。只产出你负责的【${task}】部分，承接上游、为下游铺路；这部分约 ${LEN.sec} 字，要点充分展开、有数据/案例/论证，专业可直接写进 BP，不要过短。`, g + " —— 请完成：" + task, false, Math.min(3600, LEN.mt));
          collected[m.key] = { name: m.name, task, out };
          pushFeed(m.name, m.color, out);
          prior += `【${m.name}·${task}】${out.slice(0, 400)}\n`;
          sset(m.key, "write"); await wait(700);
          if (i < dn - 1) { setCaption(`${m.name} 把接力棒交给 ${workers[i + 1].name}`); await fly(m.key, workers[i + 1].key, "接力·交接", m.color); }
          sset(m.key, "done");
        }
        // —— 遇到拿不准 → 才向老大请示决策（不是每步都汇报）——
        if (dn) {
          setCaption(`${lead.name} 巡查各环节…`);
          sset(leader, "think");
          const idxList = workers.map((m, i) => `${i + 1}. ${m.name}（${TASKMAP[m.key]}）`).join("\n");
          const outList = workers.map((m, i) => `### ${i + 1}. ${m.name}\n${collected[m.key].out}`).join("\n\n");
          let reviewRaw = "";
          try { reviewRaw = await ask(lead.system(MAJOR) + "\n你是总负责，请对下列每位搭子的产出做质量把关。严格逐行输出，每行格式：序号|分数(0-100)|是否需要重写(是/否)|一句话改进意见。只输出这些行，不要其它内容。\n成员：\n" + idxList, "各成员产出：\n" + outList); } catch { /* 评审失败则跳过 */ }
          sset(leader, "idle");
          const redo: { m: typeof workers[number]; fb: string }[] = [];
          for (const line of reviewRaw.split("\n")) {
            const mm = line.match(/^\s*(\d+)\s*[|｜]\s*(\d+)\s*[|｜]\s*([是否])\s*[|｜]\s*(.+)$/);
            if (mm) { const i = +mm[1] - 1; if (workers[i] && mm[3] === "是") redo.push({ m: workers[i], fb: mm[4].trim() }); }
          }
          for (const r of redo.slice(0, 2)) {
            const m = r.m; const task = TASKMAP[m.key] || "你的部分";
            setCaption(`${m.name} 拿不准，向 ${lead.name} 请示`);
            await fly(m.key, leader, "❓请示决策", m.color);
            sset(leader, "think"); await wait(500);
            setCaption(`${lead.name} 拍板：这块按意见重写`);
            await fly(leader, m.key, "拍板·重写", lead.color); sset(leader, "idle");
            sset(m.key, "think");
            setCaption(`${m.name} 正在按决策重写…`);
            const out2 = await ask(m.system(MAJOR) + skillInstr(active, m.key) + "\n" + ctx + `\n总负责拍板这块要改，意见：「${r.fb}」。你的原稿：\n${collected[m.key].out}\n请据意见改进、重写这一部分，更具体专业。`, "按决策重写：" + task);
            collected[m.key] = { name: m.name, task, out: out2 };
            pushFeed(m.name, m.color, "按决策重写 · " + out2);
            sset(m.key, "write"); await wait(700);
            sset(m.key, "done");
          }
        }
        // —— 材料撰写：上游成果接力到它这儿打包，再送老大终审 ——
        if (writer) {
          const task = "汇总撰写完整 BP";
          const fromKey = dn ? workers[dn - 1].key : leader;
          setCaption(`各方成果接力到 ${writer.name}，开始打包`);
          await fly(fromKey, writer.key, "交接·打包", writer.color);
          sset(writer.key, "think");
          setCaption(`${writer.name} 正在汇总撰写完整 BP 文档…`);
          const domainOut = workers.map((m) => `【${collected[m.key].name} · ${collected[m.key].task}】\n${collected[m.key].out}`).join("\n\n");
          const packed = await ask(writer.system(MAJOR) + skillInstr(active, "advisor") + "\n" + ctx + `\n以下是各搭子的产出，请把它们整理、扩写成一份结构完整、逻辑闭环、可直接参赛的商业计划书全文（按 痛点与需求/解决方案/目标用户/市场与竞争/商业模式/技术与壁垒/团队与分工/财务与融资/亮点与社会价值 分节，用 Markdown「## 」标题）。全文篇幅${LEN.total}，每个分节都要充实展开、有数据/案例/论证、措辞规范专业，避免空泛和过短：\n` + (domainOut || "（暂无领域产出，请基于项目记忆撰写）"), "把全队产出打包扩写成完整 BP。", false, LEN.mt);
          collected["__packed"] = { name: writer.name, task, out: packed };
          pushFeed(writer.name, writer.color, "汇总打包成完整 BP（约 " + packed.length + " 字）");
          sset(writer.key, "write"); await wait(700);
          setCaption(`${writer.name} 把 BP 初稿送 ${lead.name} 终审`);
          await fly(writer.key, leader, "送审·BP初稿", writer.color);
          sset(writer.key, "done");
        }
      }
      // 总负责终审 / 打磨成稿
      const packed = collected["__packed"]?.out;
      setCaption(`${lead.name} 正在${packed ? "终审" : "汇总"}、打磨成稿…`);
      sset(leader, "write");
      const crewEv = { kind: "crew_final", title: `驾驶舱成稿 · ${name || "项目"}`, meta: { team: team.join("+"), leader } };
      const finalBP = packed
        ? await ask(lead.system(MAJOR) + leadSkills + "\n" + ctx + `\n以下是「材料撰写」汇总的商业计划书全文，请你做最后把关与润色、并按需扩充：补强薄弱环节、确保逻辑闭环、保持 Markdown「## 」分节；最终全文篇幅${LEN.total}、各节充实，输出完整最终版：\n` + packed, "终审润色扩充，输出最终完整 BP。", web, LEN.mt, crewEv)
        : await ask(lead.system(MAJOR) + leadSkills + "\n" + ctx + `\n以下是各搭子（已评审、必要处已重写）的产出，请你统一打磨、综合并扩写成一份结构完整、逻辑闭环、可直接参赛的商业计划书（按 痛点与需求/解决方案/目标用户/市场与竞争/商业模式/技术与壁垒/团队与分工/财务与融资/亮点与社会价值 分节，用 Markdown「## 」标题）。全文篇幅${LEN.total}、每个分节充实展开、有数据/案例/论证：\n` + (workers.map((m) => `【${collected[m.key].name} · ${collected[m.key].task}】\n${collected[m.key].out}`).join("\n\n") || "（暂无成员产出，请基于项目记忆独立成稿）"), "打磨综合扩写成完整商业计划书。", web, LEN.mt, crewEv);
      sset(leader, "done");
      setDraft(finalBP);
      pushFeed(lead.name, lead.color, "终审定稿 ✅ 全文约 " + finalBP.length + " 字 · 点下方「查看/导出成稿」");
      setCaption("✅ 全员协同完成，成稿已就绪");
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "运行中断"); setCaption(""); }
    setRunning(false);
  }

  function reset() { setMode("setup"); setDone(false); setStage({}); setFlights([]); setFeed([]); setCaption(""); setErr(""); }

  async function doExport(kind: "word" | "pdf" | "pptx") {
    if (!draft.trim()) { setErr("还没有成稿，先点「开始协作」让全队生成 BP"); return; }
    setExp(kind); setErr("");
    try {
      const fn = name || "项目";
      if (kind === "word") {
        downloadWord(`商业计划书_${fn}.doc`, name || "商业计划书", draft);
        logClientEvidence("export_doc", { title: `驾驶舱导出 · ${fn}`, payload: { fmt: kind, chars: draft.length } });
      } else if (kind === "pdf") {
        printPdf(name || "商业计划书", draft);
        logClientEvidence("export_doc", { title: `驾驶舱导出 · ${fn}`, payload: { fmt: kind, chars: draft.length } });
      } else {
        // PPTX：优先商业级引擎（Presenton 真版式，1-2 分钟）；引擎未配置(501)自动回退轻量版
        setPptLinks(null);
        const res = await fetch("/api/ppt/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft, title: name || "商业计划书", slides: 12 }),
        });
        if (res.ok) {
          const d = await res.json();
          setPptLinks({ downloadUrl: d.downloadUrl, editUrl: d.editUrl });
        } else if (res.status === 501) {
          await downloadPptx(`路演_${fn}.pptx`, name || "商业计划书", draft);
          logClientEvidence("export_doc", { title: `驾驶舱导出 · ${fn}`, payload: { fmt: "pptx-lite", chars: draft.length } });
        } else {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "PPT 生成失败 " + res.status);
        }
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "导出失败"); }
    setExp("");
  }

  // 成稿后继续打磨：把整改意见交给总负责（功夫熊猫），输出修改后的完整 BP。
  async function doRevise() {
    const ins = revise.trim();
    if (!ins || revising || !draft.trim()) return;
    setRevising(true); setErr("");
    try {
      const boss = CREW_BY_KEY[leader] || CREW_BY_KEY["boss"];
      const out = await ask(boss.system(MAJOR) + "\n" + ctx + `\n这是当前商业计划书全文：\n${draft}\n请严格按用户要求修改，并输出修改后的【完整】商业计划书（保持 Markdown「## 」分节，全文篇幅${LEN.total}、各节充实，不要只给片段、不要附加解释）。用户的修改要求：`, ins, web, LEN.mt,
        { kind: "crew_final", title: `驾驶舱修订 · ${name || "项目"}`, meta: { revise: ins.slice(0, 120) } });
      if (out.trim()) { setDraft(out); setRevise(""); }
    } catch (e) { setErr(e instanceof Error ? e.message : "修改失败"); }
    setRevising(false);
  }

  // 保存当前项目到云端（跨设备 / 教师可查）。
  async function saveCloud() {
    if (saving) return;
    if (!draft.trim() && !name.trim()) { setCloudMsg("还没有可保存的内容"); return; }
    setSaving(true); setCloudMsg("");
    try {
      let sections: Record<string, string> = {};
      try { const r = localStorage.getItem(LS); if (r) sections = JSON.parse(r).sections || {}; } catch { /* ignore */ }
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name || "我的项目", draft, team, sections }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) setCloudMsg("请先登录后再保存（右上角 → 登录）");
      else if (!res.ok) setCloudMsg(d.error || "保存失败");
      else setCloudMsg("✓ 已保存到云端");
    } catch { setCloudMsg("网络错误"); }
    setSaving(false);
  }
  // 从云端载入项目 → 回填名称/成稿/团队，并同步到共享项目记忆。
  function onLoadProject(p: CloudProject) {
    setName(p.name || "");
    setDraft(p.draft || "");
    const tm = (Array.isArray(p.team) ? p.team : []).filter((k) => CREW_BY_KEY[k]);
    if (tm.length) { setTeam(tm); setLeader(tm.includes("boss") ? "boss" : tm[0]); }
    try { const r = localStorage.getItem(LS); const cur = r ? JSON.parse(r) : {}; localStorage.setItem(LS, JSON.stringify({ ...cur, name: p.name || "", draft: p.draft || "", sections: p.sections || {} })); } catch { /* ignore */ }
    setCloudOpen(false); setMode("setup"); setCloudMsg("✓ 已载入：" + (p.name || "项目"));
  }

  const hud: React.CSSProperties = { border: `1px solid ${T.line}`, borderRadius: 16, background: T.panel, backdropFilter: "blur(12px)" };
  const inp: React.CSSProperties = { padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.inLine}`, background: T.inBg, color: T.ink, fontSize: 13.5, outline: "none", fontFamily: "inherit" };
  const ebtn: React.CSSProperties = { padding: "8px 13px", borderRadius: 9, border: `1px solid ${T.line}`, background: dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.6)", color: T.ink, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
  const estChip = (
    <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(255,182,87,.16)", border: "1px solid rgba(255,182,87,.45)", color: dark ? "#ffd9a0" : "#9a6500", whiteSpace: "nowrap" }}>
      💰 预计消耗 ≈ <b>{estimate}</b> 积分起<span style={{ opacity: .8 }}>（含统筹/评审/汇总，打回重写每次+1）</span>
    </span>
  );
  const flowOrder = team.filter((k) => k !== leader).sort(byPhase);
  const flowChip = (k: string, label: string) => <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: `${CREW_BY_KEY[k].color}22`, border: `1px solid ${CREW_BY_KEY[k].color}55`, color: T.ink, whiteSpace: "nowrap" }}>{CREW_BY_KEY[k].emoji} {label}</span>;
  const arrow = <span style={{ color: T.mut, fontSize: 11 }}>→</span>;
  const workflowBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
      <span style={{ fontSize: 11, color: T.mut, marginRight: 2 }}>🔀 工作流</span>
      {flowChip(leader, "制定计划")}
      {flowOrder.map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{arrow}{flowChip(k, CREW_BY_KEY[k].name + (k === "advisor" ? "·打包" : ""))}</span>)}
      {arrow}{flowChip(leader, "终审成稿")}
    </div>
  );

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: T.pageBg, overflow: "hidden" }}>
      {/* 全页背景：深色=深空 + 穿梭星迹（程序化，无静态图）；浅色=柔和光场 */}
      {dark ? (
        <>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(1200px 760px at 50% -12%, #0c1740, #070b22 52%, #04030f 100%)" }} />
          <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.5 }}><WarpStarfield /></div>
        </>
      ) : (
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(1200px 600px at 70% -10%, #ffffff, #e3eafc 45%, #cfdaf4 100%)" }} />
      )}

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1180, margin: "0 auto", padding: "16px 20px 26px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
        {/* HUD 顶栏 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink, textDecoration: "none", padding: "8px 14px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.panel, backdropFilter: "blur(10px)" }}>← 返回星图</Link>
          <span style={{ fontSize: 22 }}>🛸</span>
          <b style={{ fontSize: 19, letterSpacing: "-.3px", color: T.ink, textShadow: dark ? "0 2px 14px #000" : "none" }}>创业星舰 · 驾驶舱</b>
          <span style={{ fontSize: 12.5, color: T.sub, textShadow: dark ? "0 1px 8px #000" : "none" }}>功夫熊猫统筹 · AI 搭子协同作战</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/apply/skills" title="技能商店 · 浏览 / 安装 / 沉淀技能" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 800, color: "#04030f", textDecoration: "none", padding: "8px 15px", borderRadius: 999, background: "linear-gradient(120deg,#7aa8ff,#b388ff)", boxShadow: "0 4px 16px rgba(122,168,255,.45)" }}>🛒 技能商店</Link>
            <button onClick={() => setTheme(dark ? "light" : "dark")} title="切换 深色/浅色" style={{ ...ebtn, padding: "7px 12px", borderRadius: 999 }}>{dark ? "☀️ 浅色" : "🌙 深色"}</button>
            <AccountButton accent="#7aa8ff" />
          </div>
        </div>

        {/* 作战甲板（游戏式工作区）+ 右侧半扇形添加轮盘 */}
        <div id="ck-deck" style={{ position: "relative", height: narrow ? "min(50vh, 400px)" : "min(56vh, 520px)", minHeight: narrow ? 300 : 380, borderRadius: 18, border: `1px solid ${T.line}`, overflow: "hidden", marginBottom: 12, background: "transparent", isolation: "isolate", zIndex: 0 }}>
          <CrewStage agents={agents} flights={flights} onRemove={mode === "setup" ? toggleMember : undefined} dark={dark} caption={caption} feed={feed} />

          {/* 右侧半扇形添加轮盘（宽屏·待命时；悬停看说明） */}
          {mode === "setup" && !narrow && (
            <div id="ck-fan" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 168, zIndex: 13 }}>
              <div style={{ position: "absolute", right: 14, top: 12, fontSize: 11.5, color: "#cfe0ff", textShadow: "0 1px 6px #000" }}>＋ 添加搭子</div>
              {outAgents.length === 0 && <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11.5, color: "#9fb6e0", textShadow: "0 1px 6px #000", width: 120, textAlign: "right" }}>全员已上舰 🛸</div>}
              {outAgents.map((c, i) => {
                const n = outAgents.length;
                const t = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
                const ang = t * 0.82;
                const R = 92 + Math.min(n, 6) * 9;
                const bx = 150 - Math.cos(ang) * R * 0.5;
                const by = Math.sin(ang) * R * 0.96;
                const on = hover === c.key;
                return (
                  <div key={c.key}>
                    {on && (
                      <div style={{ position: "absolute", left: bx - 34, top: `calc(50% + ${by}px)`, transform: "translate(-100%,-50%)", zIndex: 20, padding: "7px 11px", borderRadius: 10, background: "rgba(7,9,26,.94)", border: `1px solid ${c.color}88`, width: 184, textAlign: "left", boxShadow: "0 8px 24px #000a", pointerEvents: "none" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: c.color }}>{c.name} <span style={{ color: "#9fb6e0", fontWeight: 400 }}>· {c.nick}</span></div>
                        <div style={{ fontSize: 11, color: "#dce6ff", marginTop: 3, lineHeight: 1.5 }}>{c.desc}</div>
                      </div>
                    )}
                    <button onClick={() => toggleMember(c.key)} onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)} title={`${c.name} · 点击加入`}
                      style={{ position: "absolute", left: bx, top: `calc(50% + ${by}px)`, transform: `translate(-50%,-50%) scale(${on ? 1.12 : 1})`, width: 56, height: 56, borderRadius: "50%", padding: 0, cursor: "pointer", border: `2px solid ${on ? c.color : "rgba(120,200,255,.4)"}`, background: "rgba(7,9,26,.5)", boxShadow: on ? `0 0 20px ${c.color}` : "0 4px 12px #0008", transition: "transform .18s", overflow: "hidden", fontFamily: "inherit" }}>
                      <Ball k={c.key} emoji={c.emoji} color={c.color} size={56} />
                      <span style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: "50%", background: c.color, color: "#04030f", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900, border: "2px solid rgba(7,9,26,.8)" }}>＋</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 窄屏：顶部横向滚动添加条（点头像加入；移出仍在甲板内点 −） */}
          {mode === "setup" && narrow && outAgents.length > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 30, zIndex: 13, display: "flex", gap: 8, overflowX: "auto", padding: "4px 10px 6px" }}>
              {outAgents.map((c) => (
                <button key={c.key} onClick={() => toggleMember(c.key)} title={`${c.name} · ${c.desc}`}
                  style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 999, border: `1px solid ${c.color}99`, background: "rgba(7,9,26,.62)", color: "#e8f0ff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", display: "block", border: `1px solid ${c.color}` }}><Ball k={c.key} emoji={c.emoji} color={c.color} size={30} /></span>
                  {c.name} <b style={{ color: c.color }}>＋</b>
                </button>
              ))}
            </div>
          )}

        </div>

        {/* 协作完成：导出/重开按钮 —— 移出甲板、单独成行，避免绝对定位压住搭子工位标签 */}
        {done && (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
            <button onClick={() => setDrawer(true)} style={{ ...ebtn, background: "linear-gradient(120deg,#7aa8ff,#b388ff)", color: "#04030f", fontWeight: 800, border: "none" }}>📄 查看 / 导出成稿</button>
            <button onClick={reset} style={ebtn}>↺ 重新协作</button>
          </div>
        )}

        {/* 工作流：在动物们工作台之下、对话框之上 —— 自动按所选搭子编排 */}
        {mode === "setup" && (
          <div style={{ ...hud, padding: "10px 13px", marginTop: 12 }}>
            {workflowBar}
            <div style={{ fontSize: 10.5, color: T.mut, textAlign: "center", marginTop: 6 }}>按你选的搭子自动编排顺序 · 材料撰写恒在最后打包成稿</div>
          </div>
        )}

        {/* 指令台：更大的对话框 + 附件/联网/模型 */}
        {mode === "setup" && (
          <div style={{ ...hud, padding: 14, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 24 }}>🐼</span>
              <div style={{ fontSize: 12.5, color: dark ? "#ffd9b0" : "#9a5b1a", lineHeight: 1.5, flex: 1, minWidth: 200 }}><b>功夫熊猫 · 总负责</b>：把项目名和目标交给我，我带这支队伍一起干，评审、打磨，一次产出可参赛的商业计划书。</div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="项目名…" style={{ ...inp, width: 150 }} />
            </div>
            <textarea id="ck-goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} placeholder="对功夫熊猫说：例「帮我把项目打磨成一份能参赛的完整商业计划书，重点写清商业模式和技术壁垒」"
              style={{ ...inp, width: "100%", boxSizing: "border-box", minHeight: 116, resize: "vertical", lineHeight: 1.65, fontSize: 14.5 }} />

            <div style={{ marginTop: 10 }}><AttachBar atts={atts} setAtts={setAtts} accent="#7aa8ff" /></div>

            {/* 工具条：联网 / 模型 / 篇幅 / 语音 / 技能 */}
            <div id="ck-tools" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <SkillPicker toolbox={toolbox}
                activeSkillIds={activeSkillIds} onToggleSkill={(id) => setActiveSkillIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id])}
                activePluginIds={activePluginIds} onTogglePlugin={(id) => setActivePluginIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id])}
                accent="#7aa8ff" />
              <button onClick={() => setWeb((w) => !w)} title="联网检索（需在 .env 配置搜索源后生效；未配置则用知识库作答）"
                style={{ ...ebtn, borderColor: web ? "#34d399" : T.line, color: web ? "#10b981" : T.ink, background: web ? "rgba(52,211,153,.14)" : ebtn.background }}>
                🌐 联网检索 {web ? "开" : "关"}
              </button>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.mut }}>🤖 模型
                <div style={{ width: 232 }}>
                  <ModelSelect value={model} onChange={setModel} placeholder="选择模型"
                    accent={ownChat ? "#34d399" : "#7aa8ff"}
                    groups={[{ label: "", options: modelOpts.map((m) => ({ value: m.v, label: m.label })) }]} />
                </div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.mut }}>📏 篇幅
                <div style={{ width: 186 }}>
                  <ModelSelect value={lenKey} onChange={setLenKey} placeholder="选择篇幅" accent="#7aa8ff"
                    groups={[{ label: "", options: LEN_OPTS.map((o) => ({ value: o.v, label: `${o.v}（${o.total}）` })) }]} />
                </div>
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.mut }}>🎤 语音
                <MicButton onText={(t) => setGoal((g) => (g ? g + " " : "") + t)} accent="#7aa8ff" size={36} title="语音输入：点麦克风对功夫熊猫说话，自动转文字" />
              </label>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => { setCloudMsg(""); setCloudOpen(true); }} style={ebtn}>☁ 我的项目</button>
              {estChip}
              <button id="ck-start" onClick={() => { if (goal.trim()) { setErr(""); setMode("confirm"); } }} disabled={!goal.trim()}
                style={{ marginLeft: "auto", padding: "0 26px", height: 50, borderRadius: 12, border: "none", fontWeight: 800, fontSize: 15, color: "#04030f", cursor: !goal.trim() ? "default" : "pointer", background: "linear-gradient(120deg,#7aa8ff,#b388ff)", opacity: !goal.trim() ? 0.5 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                🚀 开始协作
              </button>
            </div>
            {web && <div style={{ fontSize: 11, color: T.mut, marginTop: 8 }}>※ 联网检索需在服务器 .env 配置 SEARCH_API_URL / SEARCH_API_KEY 后真正生效；未配置时本次自动改用知识库作答。</div>}
            {err && <div style={{ color: "#ef5e6e", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
            {cloudMsg && <div style={{ color: cloudMsg.startsWith("✓") ? "#7ef0c0" : "#ffb066", fontSize: 12.5, marginTop: 8 }}>{cloudMsg}</div>}
          </div>
        )}
        {mode === "run" && err && <div style={{ ...hud, padding: 12, color: "#ef5e6e", fontSize: 12.5 }}>{err} · <button onClick={reset} style={{ ...ebtn, padding: "3px 9px", marginLeft: 6 }}>返回</button></div>}
      </div>

      {/* 出发确认 + 积分预估 */}
      {mode === "confirm" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(4,3,15,.6)", backdropFilter: "blur(4px)" }} onClick={() => setMode("setup")}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...hud, width: "min(460px,92vw)", padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>🐼🚀</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 8 }}>确认出发？</div>
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.7, marginBottom: 8 }}>
              <b style={{ color: CREW_BY_KEY[leader].color }}>{CREW_BY_KEY[leader].name}</b> 将带 <b>{team.length - 1}</b> 位搭子，按以下工作流协同：
            </div>
            <div style={{ marginBottom: 14 }}>{workflowBar}</div>
            <div style={{ marginBottom: 16 }}>{estChip}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={run} style={{ padding: "10px 22px", borderRadius: 11, border: "none", fontWeight: 800, fontSize: 14, color: "#04030f", cursor: "pointer", background: "linear-gradient(120deg,#7aa8ff,#b388ff)", fontFamily: "inherit" }}>确认出发 🚀</button>
              <button onClick={() => setMode("setup")} style={ebtn}>再想想</button>
            </div>
          </div>
        </div>
      )}

      {/* 成稿抽屉 */}
      {drawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(4,3,15,.6)", backdropFilter: "blur(4px)" }} onClick={() => setDrawer(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...hud, width: "min(760px,94vw)", maxHeight: "88vh", padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <b style={{ fontSize: 15, color: T.ink }}>{name || "商业计划书"} · 成稿</b>
              <span style={{ fontSize: 11.5, color: T.mut }}>可手动编辑后再导出</span>
              <button onClick={() => setDrawer(false)} style={{ ...ebtn, marginLeft: "auto", padding: "5px 11px" }}>✕ 关闭</button>
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
              style={{ flex: 1, minHeight: 320, padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.inLine}`, background: T.inBg, color: T.ink, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.75 }} />
            {/* 继续打磨：把整改意见交给功夫熊猫，原稿基础上改 */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18 }}>🐼</span>
              <input value={revise} onChange={(e) => setRevise(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doRevise(); }} disabled={revising}
                placeholder="让功夫熊猫继续改：例「把商业模式和财务测算写得更具体」" style={{ ...inp, flex: 1, minWidth: 220 }} />
              <button onClick={doRevise} disabled={revising || !revise.trim()}
                style={{ ...ebtn, fontWeight: 700, color: "#9fc2ff", borderColor: "#7aa8ff66", background: "rgba(122,168,255,.14)", opacity: (revising || !revise.trim()) ? 0.55 : 1 }}>
                {revising ? "🐼 修改中…" : "✨ 继续打磨"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: T.mut }}>导出：</span>
              <button onClick={() => doExport("word")} style={ebtn} disabled={!!exp}>{exp === "word" ? "…" : "⬇ Word"}</button>
              <button onClick={() => doExport("pdf")} style={ebtn} disabled={!!exp}>{exp === "pdf" ? "…" : "⬇ PDF"}</button>
              <button onClick={() => doExport("pptx")} style={ebtn} disabled={!!exp}>{exp === "pptx" ? "引擎生成中（约1-2分钟）…" : "🎬 PPTX 路演（商业级）"}</button>
              {pptLinks && (pptLinks.downloadUrl || pptLinks.editUrl) && (
                <>
                  {pptLinks.downloadUrl && <a href={pptLinks.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 800, color: "#8ef0c0", textDecoration: "none", border: "1px solid rgba(52,211,153,.5)", borderRadius: 999, padding: "6px 13px" }}>⬇ 下载 PPTX</a>}
                  {pptLinks.editUrl && <a href={pptLinks.editUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: "#7ad0ff", textDecoration: "none", border: "1px solid rgba(122,208,255,.5)", borderRadius: 999, padding: "6px 13px" }}>✏️ 在线编辑</a>}
                </>
              )}
              <span style={{ width: 1, height: 20, background: T.line }} />
              <button onClick={saveCloud} disabled={saving} style={{ ...ebtn, color: "#9fc2ff", borderColor: "#7aa8ff66" }}>{saving ? "保存中…" : "☁ 保存到云"}</button>
              {cloudMsg && <span style={{ color: cloudMsg.startsWith("✓") ? "#7ef0c0" : "#ffb066", fontSize: 12 }}>{cloudMsg}</span>}
              {err && <span style={{ color: "#ef5e6e", fontSize: 12 }}>{err}</span>}
            </div>
          </div>
        </div>
      )}

      {cloudOpen && <CloudProjects dark={dark} onLoad={onLoadProject} onClose={() => setCloudOpen(false)} />}
      {intro && <CockpitIntro onDone={() => { setIntro(false); try { sessionStorage.setItem(INTRO_SS, "1"); } catch { /* ignore */ } }} />}
      <Tour active={mode === "setup" && !intro} seenKey="cockpit_tour_v3" steps={COCKPIT_STEPS} />

      <style>{`@keyframes cs-blink{0%,100%{opacity:.25}50%{opacity:1}}`}</style>
    </div>
  );
}
