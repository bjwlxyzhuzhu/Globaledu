import type { Metadata } from "next";
import "./globals.css";
import DailyBonus from "@/components/DailyBonus";

export const metadata: Metadata = {
  title: "双创AI星际 · 创赛智能搭子",
  description: "创新创业教育 × 比赛 × AI 工具应用 —— 一群懂创赛的智能搭子",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}<DailyBonus /></body>
    </html>
  );
}
