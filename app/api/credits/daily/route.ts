import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DAILY_BONUS = 30;

/** 以中国时区计算「今天」（YYYY-MM-DD），避免 UTC 跨日导致发放时机错乱 */
function todayCN(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

/**
 * 每日登录奖励：登录用户每个自然日首次访问 → +30 积分。
 * 幂等：profiles.last_bonus_at 当天已发则不再发。未登录 / 迁移未跑 / 出错 → 静默返回 granted:false，不阻塞页面。
 */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ granted: false });

  const admin = createAdminClient();
  try {
    const { data: prof, error: readErr } = await admin
      .from("profiles")
      .select("credits, last_bonus_at")
      .eq("id", user.id)
      .single();
    if (readErr) throw readErr;

    const today = todayCN();
    if (prof?.last_bonus_at === today) {
      return NextResponse.json({ granted: false, credits: prof?.credits ?? 0 });
    }

    const credits = (prof?.credits ?? 0) + DAILY_BONUS;
    const { error: upErr } = await admin
      .from("profiles")
      .update({ credits, last_bonus_at: today })
      .eq("id", user.id);
    if (upErr) throw upErr;

    return NextResponse.json({ granted: true, added: DAILY_BONUS, credits });
  } catch (e) {
    // 多半是 last_bonus_at 列尚未迁移；静默降级，不影响使用
    return NextResponse.json({ granted: false, error: e instanceof Error ? e.message : "fail" });
  }
}
