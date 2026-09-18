"use client";
import Link from "next/link";
import { ReactNode } from "react";
import AccountButton from "@/components/AccountButton";

/** 闯关中心子页通用外壳：深空背景 + 顶部「返回星图」+ 标题。 */
export default function LearnChrome({
  emoji, title, subtitle, children,
}: { emoji: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <>
      <div className="deep" />
      <div className="neb n1" />
      <div className="neb n2" />
      <div className="neb n3" />
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "22px 24px 80px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink)",
              textDecoration: "none", padding: "8px 14px", borderRadius: 999, border: "1px solid var(--line)",
              background: "rgba(255,255,255,.05)", backdropFilter: "blur(12px)",
            }}
          >
            ← 返回星图
          </Link>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 26 }}>{emoji}</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.5px" }}>{title}</h1>
            {subtitle && <span style={{ fontSize: 13, color: "var(--mut)" }}>{subtitle}</span>}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/me/growth"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink)",
                textDecoration: "none", padding: "8px 14px", borderRadius: 999, border: "1px solid var(--line)",
                background: "rgba(255,255,255,.05)", backdropFilter: "blur(12px)",
              }}
            >
              🌌 成长星图
            </Link>
            <AccountButton />
          </div>
        </div>
        <div style={{ marginTop: 22 }}>{children}</div>
        <footer style={{ marginTop: 44, paddingTop: 16, borderTop: "1px solid var(--line)", fontSize: 11.5, color: "var(--mut)", lineHeight: 1.8 }}>
          ⚠️ AI 辅助生成内容仅供参考，请自行核验；最终判断与责任由师生承担 · 数据最小化采集、加密存储 · <Link href="/compliance" style={{ color: "var(--cyan)" }}>合规与隐私说明</Link>
        </footer>
      </div>
    </>
  );
}
