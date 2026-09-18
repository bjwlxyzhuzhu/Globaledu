import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index';
import { requireAuth, type TokenPayload } from '../lib/auth';
import { award, MODULE_DIM } from '../lib/points';

// 学习进度落库：登录后各模块成绩同步到服务端，重算能力雷达，并发「学习」积分。
const router = Router();

type Row = Record<string, unknown>;
type Stmt = { get: (...a: unknown[]) => Row | undefined; all: (...a: unknown[]) => Row[]; run: (...a: unknown[]) => unknown };

// 依据该用户的全部学习记录，重算每个能力维度（按模块映射归并求均分），upsert 到 ability_scores。
function recomputeAbility(db: { prepare(sql: string): unknown }, uid: string): void {
  const rows = (db.prepare('SELECT module, score FROM learning_records WHERE user_id = ?') as Stmt).all(uid);
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    const mod = String(r.module || '').split(':')[0];
    const dim = MODULE_DIM[mod];
    if (!dim) continue;
    const sc = Number(r.score);
    if (!Number.isFinite(sc)) continue;
    (acc[dim] ||= { sum: 0, n: 0 }).sum += sc;
    acc[dim].n += 1;
  }
  const now = Date.now();
  for (const [dim, { sum, n }] of Object.entries(acc)) {
    const score = Math.round(sum / Math.max(1, n));
    (db.prepare(
      `INSERT INTO ability_scores (user_id, dim, score, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, dim) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at`,
    ) as Stmt).run(uid, dim, score, now);
  }
}

// POST /api/progress { module, item, score }  —— module 形如 "listening"/"hsk"/"hanzi"…（取前缀即可）
router.post('/progress', requireAuth, async (req, res) => {
  const uid = (req as unknown as { user: TokenPayload }).user.uid;
  const moduleRaw = String((req.body?.module ?? '') as string).trim();
  const module = moduleRaw.split(':')[0]; // 容忍传整 key
  const item = String((req.body?.item ?? '') as string);
  const score = Number(req.body?.score);
  if (!module || !Number.isFinite(score)) {
    res.status(400).json({ error: 'module 和 score 必填' });
    return;
  }
  try {
    const db = await getDb();
    (db.prepare(
      'INSERT INTO learning_records (id, user_id, module, item_id, score, metrics_json, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ) as Stmt).run(randomUUID(), uid, module, item, score, JSON.stringify({ via: 'progress' }), Date.now());
    recomputeAbility(db, uid);
    const awarded = award(db, uid, 'learn');
    const row = (db.prepare('SELECT credits FROM users WHERE id = ?') as Stmt).get(uid);
    res.json({ ok: true, awarded, credits: row?.credits ?? 0 });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
