import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../lib/auth';

// 用 Node 内置 node:sqlite（无需原生编译、不怕杀软删 .node）。
// 懒加载：仅在真正用到时（M5 起）才动态 import，M1/M2 不触碰，规避实验模块的启动告警。
type AnyDb = { exec(sql: string): void; prepare(sql: string): unknown };
let db: AnyDb | null = null;

// 幂等迁移：给旧库补登录/积分/时长所需的列与种子管理员。可重复运行。
function migrate(d: AnyDb): void {
  // users 增列（旧库已有该列时 ALTER 会抛错，逐条 try/catch 忽略即可）
  const addCols = [
    "ALTER TABLE users ADD COLUMN username TEXT",
    "ALTER TABLE users ADD COLUMN password_hash TEXT",
    "ALTER TABLE users ADD COLUMN student_no TEXT",
    "ALTER TABLE users ADD COLUMN last_login_date TEXT",
    "ALTER TABLE users ADD COLUMN total_active_sec INTEGER DEFAULT 0",
  ];
  for (const sql of addCols) {
    try {
      d.exec(sql);
    } catch {
      /* 列已存在，忽略 */
    }
  }

  // 种子管理员：无 teacher 角色账号时插入一个（密码读 ADMIN_PASSWORD，默认 admin888，提示用户改）。
  try {
    const row = (d.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'teacher'") as {
      get: () => { n: number };
    }).get();
    if (!row || row.n === 0) {
      const pwd = process.env.ADMIN_PASSWORD || 'admin888';
      (d.prepare(
        'INSERT INTO users (id, name, role, username, password_hash, credits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ) as { run: (...a: unknown[]) => unknown }).run(
        randomUUID(),
        '管理员',
        'teacher',
        'admin',
        hashPassword(pwd),
        0,
        Date.now(),
      );
      if (!process.env.ADMIN_PASSWORD) {
        console.warn('[auth] 已创建默认管理员 admin / admin888 —— 请在 .env 设置 ADMIN_PASSWORD 后重启并修改。');
      }
    }
  } catch (e) {
    console.warn('[db] seed admin failed:', (e as Error).message);
  }
}

export async function getDb(): Promise<AnyDb> {
  if (db) return db;
  // 动态 import + any 转换：避免 @types/node 是否带 node:sqlite 类型造成的编译差异
  const sqlite = (await import('node:sqlite')) as unknown as { DatabaseSync: new (p: string) => AnyDb };
  const dbPath = process.env.DB_PATH || path.resolve(import.meta.dirname, '../../data.sqlite');
  db = new sqlite.DatabaseSync(dbPath);
  const schemaPath = path.resolve(import.meta.dirname, 'schema.sql');
  if (existsSync(schemaPath)) db.exec(readFileSync(schemaPath, 'utf-8'));
  migrate(db);
  return db;
}
