// 创建演示账号（admin + 学生）。
// 用法（在 web/ 目录）：node --env-file=.env.local scripts/seed.mjs
// 前提：已在 Supabase 跑过 supabase/migrations/0001_init.sql
import { createClient } from "@supabase/supabase-js";
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ 缺少环境变量。请用：node --env-file=.env.local scripts/seed.mjs");
  process.exit(1);
}
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const DOMAIN = "bjwlxy.lab"; // 学号伪邮箱域名（与登录页一致）

async function ensure(no, name, role, pwd, credits) {
  const email = `${no}@${DOMAIN}`;
  let id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    // 已存在 → 查找并重置密码（让 seed 可重复运行）
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    id = list?.users?.find((u) => u.email === email)?.id;
    if (id) await admin.auth.admin.updateUserById(id, { password: pwd });
  } else {
    id = data.user.id;
  }
  if (!id) {
    console.error("✗ 失败:", email, error?.message);
    return;
  }
  // profiles 由触发器自动建，这里补学号/角色/积分
  const { error: pe } = await admin
    .from("profiles")
    .update({ student_no: no, name, role, credits })
    .eq("id", id);
  if (pe) console.error("  ⚠ 档案更新失败:", pe.message);
  console.log(`✓ ${role.padEnd(7)} 学号:${no}  密码:${pwd}  (${name})`);
}

console.log("== 创建演示账号 ==");
await ensure("admin", "课程管理员", "admin", "Admin@2026", 9999);
await ensure("202596057038", "演示学生", "student", "Student@2026", 120);
console.log("== 完成。登录页用「学号 + 密码」登录（学号即 admin / 202596057038） ==");
