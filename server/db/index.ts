import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// 用 Node 内置 node:sqlite（无需原生编译、不怕杀软删 .node）。
// 懒加载：仅在真正用到时（M5 起）才动态 import，M1/M2 不触碰，规避实验模块的启动告警。
type AnyDb = { exec(sql: string): void; prepare(sql: string): unknown };
let db: AnyDb | null = null;

export async function getDb(): Promise<AnyDb> {
  if (db) return db;
  // 动态 import + any 转换：避免 @types/node 是否带 node:sqlite 类型造成的编译差异
  const sqlite = (await import('node:sqlite')) as unknown as { DatabaseSync: new (p: string) => AnyDb };
  const dbPath = process.env.DB_PATH || path.resolve(import.meta.dirname, '../../data.sqlite');
  db = new sqlite.DatabaseSync(dbPath);
  const schemaPath = path.resolve(import.meta.dirname, 'schema.sql');
  if (existsSync(schemaPath)) db.exec(readFileSync(schemaPath, 'utf-8'));
  return db;
}
