import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import AdminConsole from "@/components/admin/AdminConsole";

export const dynamic = "force-dynamic"; // 依赖登录会话

/** 管理端入口（服务端 gate）：非 admin/teacher 直接跳回首页。 */
export default async function AdminPage() {
  const me = await requireAdmin();
  if (!me) redirect("/");
  return <AdminConsole me={{ id: me.id, name: me.name ?? null, role: (me as { role?: string }).role ?? null }} />;
}
