import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** 读取用户当前积分（预检用） */
export async function getCredits(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data?.credits ?? 0;
}

/**
 * 原子扣分 + 写 usage_logs（调用数据库 deduct_credits RPC）。
 * 积分不足返回 { ok:false }，不抛错。
 */
export async function deductCredits(
  userId: string,
  action: string,
  cost: number,
  meta: Record<string, unknown> = {}
): Promise<{ ok: boolean; remaining: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("deduct_credits", {
    p_user: userId,
    p_action: action,
    p_cost: cost,
    p_meta: meta,
  });
  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      return { ok: false, remaining: 0 };
    }
    throw error;
  }
  return { ok: true, remaining: data as number };
}
