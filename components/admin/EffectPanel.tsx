"use client";
// P4 · 成效面板：说明书第六节"应用成效"全指标自动统计 + 一键复制成文。
import { useEffect, useState } from "react";

type Effect = {
  updatedAt: string;
  coverage: { students: number; activeUsers: number; chats: number; chatsPerUser: number; visits: number };
  output: { topics: number; drafts: number; exports: number; skills: number };
  growth: { defenses: number; paired: number; preAvg: number; postAvg: number; delta: number };
  intervention: { total: number; responded: number; disputed: number; responseRate: number | null };
};

export default function EffectPanel() {
  const [d, setD] = useState<Effect | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/effect")
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "加载失败"); setD(j); })
      .catch((e) => setErr(e instanceof Error ? e.message : "网络错误"));
  }, []);

  if (err) return <p style={{ color: "#f87171", fontSize: 14 }}>{err}</p>;
  if (!d) return <p style={{ color: "var(--mut)", fontSize: 14 }}>正在统计…</p>;

  const sixth =
    `平台累计访问 ${d.coverage.visits} 次；注册学生 ${d.coverage.students} 人，活跃使用 ${d.coverage.activeUsers} 人，累计人机对话 ${d.coverage.chats} 轮（人均 ${d.coverage.chatsPerUser} 轮）。` +
    `学生共形成选题结论 ${d.output.topics} 项、商业计划书成稿 ${d.output.drafts} 份、导出参赛文档 ${d.output.exports} 份、启用方法技能 ${d.output.skills} 次。` +
    `模拟答辩累计 ${d.growth.defenses} 场，${d.growth.paired} 名学生完成能力前后测：雷达均分由期初 ${d.growth.preAvg} 提升至 ${d.growth.postAvg}（提升 ${d.growth.delta} 分）。` +
    `系统共发出学习干预 ${d.intervention.total} 次，学生回应率 ${d.intervention.responseRate ?? "—"}%${d.intervention.disputed ? `（其中 ${d.intervention.disputed} 次申诉均经教师裁决）` : ""}。` +
    `以上数据均由平台证据链自动记录（服务端时间戳、可回放、不可篡改）。`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(sixth); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* 忽略 */ }
  };

  const G = (title: string, items: [string, string | number][]) => (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "rgba(255,255,255,.035)", padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10 }}>
        {items.map(([lb, v]) => (
          <div key={lb}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--cyan)" }}>{v}</div>
            <div style={{ fontSize: 11.5, color: "var(--mut)" }}>{lb}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.7 }}>
        说明书第六节「应用成效」所有指标的实时自动统计（更新于 {new Date(d.updatedAt).toLocaleString("zh-CN")}）。全部来自证据链与用量日志真实聚合——评委要看原始数据，管理端随时可查。
      </p>
      {G("📡 覆盖与使用", [["累计访问", d.coverage.visits], ["注册学生", d.coverage.students], ["活跃使用", d.coverage.activeUsers], ["累计对话", d.coverage.chats], ["人均对话", d.coverage.chatsPerUser]])}
      {G("📦 产出证据", [["选题结论", d.output.topics], ["BP 成稿", d.output.drafts], ["导出文档", d.output.exports], ["技能启用", d.output.skills]])}
      {G("📈 能力前后测", [["答辩场次", d.growth.defenses], ["前后测人数", d.growth.paired], ["期初均分", d.growth.preAvg], ["最新均分", d.growth.postAvg], ["提升", (d.growth.delta >= 0 ? "+" : "") + d.growth.delta]])}
      {G("🦉 干预闭环", [["发出督导卡", d.intervention.total], ["学生已回应", d.intervention.responded], ["申诉", d.intervention.disputed], ["回应率", d.intervention.responseRate === null ? "—" : d.intervention.responseRate + "%"]])}

      <div style={{ border: "1px solid rgba(52,211,153,.4)", borderRadius: 14, background: "rgba(52,211,153,.06)", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <b style={{ fontSize: 13 }}>📋 说明书第六节 · 一键成文</b>
          <button onClick={copy} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(52,211,153,.5)", background: "rgba(52,211,153,.15)", color: "#8ef0c0", cursor: "pointer", fontFamily: "inherit" }}>
            {copied ? "✓ 已复制" : "复制文案"}
          </button>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--ink)" }}>{sixth}</p>
      </div>
    </div>
  );
}
