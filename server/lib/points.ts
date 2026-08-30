// 积分逻辑：发分写流水（point_events）并累加到 users.credits。
// 分值写成常量，便于以后调整或做成可配置。db 由调用方传入，避免循环依赖。
import { randomUUID } from 'node:crypto';

type AnyDb = { prepare(sql: string): unknown };
type Stmt = { run: (...a: unknown[]) => unknown; get?: (...a: unknown[]) => unknown };

export type PointType = 'register' | 'daily' | 'learn' | 'chat';

export const POINTS: Record<PointType, number> = {
  register: 20, // 首次登录（注册激活）
  daily: 10, // 每日首次登录
  learn: 5, // 完成一次学习（模块/闯关/出题）
  chat: 2, // 与智能体一次对话
};

// 学习模块前缀 → 六维能力维度（与 ability_scores.dim 的 CHECK 一致）。
// 用于把各模块成绩归并成能力雷达。未列出的模块不计入雷达。
export const MODULE_DIM: Record<string, string> = {
  listening: 'listen',
  speaking: 'speak',
  reading: 'read',
  hsk: 'read',
  writing: 'write',
  hanzi: 'hanzi',
  culture: 'culture',
  culturequiz: 'culture',
  cityquiz: 'culture',
  hskk: 'hskk',
};

// 发分：写 point_events 明细 + 累加 users.credits。返回实发分值。
export function award(db: AnyDb, userId: string, type: PointType): number {
  const pts = POINTS[type] || 0;
  if (!userId || pts <= 0) return 0;
  try {
    (db.prepare('INSERT INTO point_events (id, user_id, type, points, ts) VALUES (?, ?, ?, ?, ?)') as Stmt).run(
      randomUUID(),
      userId,
      type,
      pts,
      Date.now(),
    );
    (db.prepare('UPDATE users SET credits = COALESCE(credits, 0) + ? WHERE id = ?') as Stmt).run(pts, userId);
  } catch {
    return 0;
  }
  return pts;
}

// 兑换扣分：余额不足返回 false；否则写负向流水(type='redeem') + 扣 credits，返回剩余积分。
export function spend(db: AnyDb, userId: string, cost: number): { ok: boolean; remaining: number } {
  if (!userId || cost <= 0) return { ok: false, remaining: 0 };
  try {
    const row = (db.prepare('SELECT credits FROM users WHERE id = ?') as Stmt).get?.(userId) as
      | { credits?: number }
      | undefined;
    const bal = Number(row?.credits ?? 0);
    if (bal < cost) return { ok: false, remaining: bal };
    (db.prepare('INSERT INTO point_events (id, user_id, type, points, ts) VALUES (?, ?, ?, ?, ?)') as Stmt).run(
      randomUUID(),
      userId,
      'redeem',
      -cost,
      Date.now(),
    );
    (db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?') as Stmt).run(cost, userId);
    return { ok: true, remaining: bal - cost };
  } catch {
    return { ok: false, remaining: 0 };
  }
}
