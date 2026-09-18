import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * 管理端 Supabase 客户端（secret/service_role key，绕过 RLS）。
 * ⚠️ 只能在服务端使用，切勿在客户端导入。用于扣分、写日志、管理操作。
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
