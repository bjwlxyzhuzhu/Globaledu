import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const KEY = "chaoxing";
type Config = {
  enabled: boolean; schoolId: string; baseUrl: string; appKey: string; appSecret: string;
  rosterSync: boolean; sso: boolean; gradePush: boolean;
};
const DEFAULTS: Config = { enabled: false, schoolId: "", baseUrl: "https://api.chaoxing.com", appKey: "", appSecret: "", rosterSync: true, sso: false, gradePush: false };

/** 读取超星对接配置（管理员）。 */
export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("app_config").select("value").eq("key", KEY).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: { ...DEFAULTS, ...(data?.value || {}) } });
}

/** 保存配置 / 演示动作（测试连接、同步名册）。演示动作不真实调用超星，仅返回模拟结果。 */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  let body: { action?: string; config?: Partial<Config> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  const action = body?.action || "save";
  const admin = createAdminClient();

  if (action === "save") {
    const cfg = { ...DEFAULTS, ...(body.config || {}) };
    const { error } = await admin.from("app_config").upsert({ key: KEY, value: cfg, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // —— 以下为演示动作：不真实调用超星开放平台（真对接需学校提供 AppKey/密钥并按其接口适配）——
  const cfg = { ...DEFAULTS, ...(body.config || {}) };
  if (action === "test") {
    if (!cfg.baseUrl || !cfg.appKey) return NextResponse.json({ ok: false, msg: "请先填写「接口地址」与「AppKey」再测试" });
    return NextResponse.json({ ok: true, demo: true, msg: `连接成功（演示）：${cfg.baseUrl} · 机构 ${cfg.schoolId || "未填"}` });
  }
  if (action === "sync-roster") {
    if (!cfg.appKey) return NextResponse.json({ ok: false, msg: "请先填写 AppKey 并启用对接" });
    const n = 30 + Math.floor(Math.random() * 90);
    return NextResponse.json({ ok: true, demo: true, count: n, msg: `已从超星同步 ${n} 名学生（演示数据，未真实调用超星接口）` });
  }
  return NextResponse.json({ error: "未知动作" }, { status: 400 });
}
