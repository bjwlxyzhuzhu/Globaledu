"use client";
// 每日登录积分：登录用户每天首次进站自动 +30 积分，弹一条祝贺浮条。未登录/已领过 → 后端静默返回，不打扰。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DailyBonus() {
  const router = useRouter();
  const [toast, setToast] = useState<{ added: number; credits: number } | null>(null);

  useEffect(() => {
    // 每个自然日每个会话只请求一次（在 fetch 前置位，规避 React StrictMode 双挂载重复发放）
    let key = "";
    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
      key = "daily_bonus_" + today;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* 无 sessionStorage 也继续，后端仍按日去重 */ }

    let alive = true;
    fetch("/api/credits/daily", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.granted) return;
        setToast({ added: d.added ?? 30, credits: d.credits ?? 0 });
        router.refresh(); // 刷新服务端渲染的积分显示
        setTimeout(() => alive && setToast(null), 5200);
      })
      .catch(() => { try { sessionStorage.removeItem(key); } catch { /* ignore */ } }); // 失败允许下次重试

    return () => { alive = false; };
  }, [router]);

  if (!toast) return null;
  return (
    <div role="status" style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 4000, pointerEvents: "none", animation: "dbIn .45s cubic-bezier(.2,.9,.3,1.2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderRadius: 999, background: "linear-gradient(120deg, rgba(16,22,48,.96), rgba(28,18,52,.96))", border: "1px solid rgba(255,210,120,.5)", boxShadow: "0 12px 36px rgba(0,0,0,.5), 0 0 24px rgba(255,200,90,.25)", color: "#ffe9c2", fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 18 }}>🎁</span>
        今日登录 <b style={{ color: "#ffd24a", fontSize: 16 }}>+{toast.added}</b> 积分
        <span style={{ color: "#a9bbe0", fontWeight: 500, fontSize: 12.5 }}>· 余额 {toast.credits}</span>
      </div>
      <style>{`@keyframes dbIn{from{opacity:0;transform:translate(-50%,-14px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}
