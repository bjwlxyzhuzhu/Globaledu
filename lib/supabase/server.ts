import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 服务端 Supabase 客户端（读 cookie 会话，受 RLS 约束）。用于 Server Component / Route Handler。 */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在 Server Component 中调用 set 会抛错，可忽略（由 middleware 负责刷新会话）
          }
        },
      },
    }
  );
}
