import { createClient } from "@/lib/supabase/server";

/** 取当前登录用户（无则 null） */
export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** 取当前用户档案（含积分/角色）；未登录返回 null */
export async function getProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, name, student_no, role, credits")
    .eq("id", user.id)
    .single();
  return data;
}
