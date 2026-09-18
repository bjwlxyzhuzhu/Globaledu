// 一键把 supabase/migrations/ 下所有迁移跑到云端项目（走 Supabase Management API）。
// 用法（web/ 目录）：
//   node --env-file=.env.local scripts/apply-migrations.mjs
// 需要 .env.local 里额外有一行个人访问令牌：
//   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx      （控制台 → Account → Access Tokens 生成）
// 项目 ref 从 NEXT_PUBLIC_SUPABASE_URL 自动解析。全部迁移幂等，可重复执行。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.resolve(fileURLToPath(import.meta.url), "../../supabase/migrations");
const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];

if (!token) { console.error("✗ 缺少 SUPABASE_ACCESS_TOKEN（控制台 Account → Access Tokens 生成 sbp_ 开头的令牌）"); process.exit(1); }
if (!ref)   { console.error("✗ NEXT_PUBLIC_SUPABASE_URL 解析不出项目 ref：" + url); process.exit(1); }

async function run(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
}

const files = readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
console.log(`== 项目 ${ref} · 共 ${files.length} 个迁移 ==`);
for (const f of files) {
  process.stdout.write(`  ${f} … `);
  try { await run(readFileSync(path.join(DIR, f), "utf8")); console.log("✓"); }
  catch (e) { console.log("✗\n     " + e.message); process.exit(1); }
}

const tables = await run(
  "select table_name from information_schema.tables where table_schema='public' order by 1"
);
console.log("\n== 建表完成，public 下现有表 ==");
console.log(tables.map((t) => "  · " + t.table_name).join("\n"));
console.log("\n下一步：node --env-file=.env.local scripts/seed.mjs");
