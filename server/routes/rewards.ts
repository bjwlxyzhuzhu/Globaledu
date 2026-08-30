import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index';
import { readJson } from '../lib/data';
import { requireAuth, type TokenPayload } from '../lib/auth';
import { spend } from '../lib/points';
import type { Reward } from '../../shared/types';

// 积分中心：奖励目录（data/rewards.json，老师可编辑）+ 兑换 + 我的兑换 + 排行榜。
const router = Router();

type Row = Record<string, unknown>;
type Stmt = { get: (...a: unknown[]) => Row | undefined; all: (...a: unknown[]) => Row[]; run: (...a: unknown[]) => unknown };

// GET /api/rewards —— 奖励目录（公开，登录与否都能看）
router.get('/rewards', async (_req, res) => {
  res.json({ rewards: await readJson<Reward[]>('rewards.json', []) });
});

// POST /api/redeem { rewardId } —— 兑换：校验余额→扣分→记录（status=pending 待老师发放）
router.post('/redeem', requireAuth, async (req, res) => {
  const uid = (req as unknown as { user: TokenPayload }).user.uid;
  const rewardId = String((req.body?.rewardId ?? '') as string);
  try {
    const rewards = await readJson<Reward[]>('rewards.json', []);
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward) {
      res.status(404).json({ error: '奖励不存在' });
      return;
    }
    const db = await getDb();
    const result = spend(db, uid, reward.cost);
    if (!result.ok) {
      res.status(400).json({ error: '积分不足', remaining: result.remaining });
      return;
    }
    const id = randomUUID();
    (db.prepare(
      'INSERT INTO redemptions (id, user_id, reward_id, reward_name, cost, status, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ) as Stmt).run(id, uid, reward.id, reward.name_zh, reward.cost, 'pending', Date.now());
    res.json({ ok: true, remaining: result.remaining, redemption: { id, reward_name: reward.name_zh, cost: reward.cost, status: 'pending' } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/redemptions/me —— 我的兑换记录
router.get('/redemptions/me', requireAuth, async (req, res) => {
  const uid = (req as unknown as { user: TokenPayload }).user.uid;
  try {
    const db = await getDb();
    const rows = (db.prepare(
      'SELECT id, reward_id, reward_name, cost, status, ts FROM redemptions WHERE user_id = ? ORDER BY ts DESC LIMIT 100',
    ) as Stmt).all(uid);
    res.json({ redemptions: rows });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/leaderboard —— 积分排行榜（学生 Top 50）+ 我的名次
router.get('/leaderboard', requireAuth, async (req, res) => {
  const uid = (req as unknown as { user: TokenPayload }).user.uid;
  try {
    const db = await getDb();
    const top = (db.prepare(
      "SELECT id, name, student_no, credits FROM users WHERE role = 'student' ORDER BY credits DESC, name LIMIT 50",
    ) as Stmt).all().map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      student_no: r.student_no,
      credits: r.credits ?? 0,
      me: r.id === uid,
    }));
    // 我的名次（即使不在 Top50）：积分严格高于我的人数 + 1
    const meRow = (db.prepare('SELECT credits FROM users WHERE id = ?') as Stmt).get(uid);
    const myCredits = Number(meRow?.credits ?? 0);
    const higher = (db.prepare(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'student' AND credits > ?",
    ) as Stmt).get(myCredits);
    const myRank = (Number(higher?.n ?? 0)) + 1;
    res.json({ top, me: { rank: myRank, credits: myCredits } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
