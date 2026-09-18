import "server-only";
import { getProfile } from "@/lib/auth";

/** 管理端权限校验：返回当前管理员档案，非 admin/teacher 返回 null。用于 /api/admin/* 与 /admin 页面 gate。 */
export async function requireAdmin() {
  const p = await getProfile();
  if (!p || !["admin", "teacher"].includes(((p as { role?: string }).role) || "")) return null;
  return p;
}
