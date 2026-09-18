// 轻量限流：进程内固定窗口计数，免第三方依赖（与 lib/auth.ts 同一取舍）。
// 用途：给触达付费上游（DeepSeek / MiniMax）的接口兜底，防止单个账号刷量或整体额度被打穿。
//
// 局限（有意接受）：计数只在内存里，容器重启即清零；单容器部署够用，
// 将来若多副本或多进程，需要换成 SQLite 或 Redis 之类的共享计数。
import type { Request, Response, NextFunction } from 'express';
import type { TokenPayload } from './auth';

interface Bucket {
  count: number;
  resetAt: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// 注意用 Number.isFinite 而不是 `|| 默认值`：后者会把显式配置的 0（＝完全关闭 AI）
// 当成「没配置」而回落到默认值，配置反而失效。
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

// 每个学生每小时可发起的 AI 调用数；课堂场景 30 次足够，刷量会被挡住。
const PER_USER_HOURLY = envInt('AI_RATE_PER_USER_HOURLY', 30);
// 全站每日总调用上限：真正的「钱包保险丝」，即使账号全被盗用也不会无限烧额度。
const GLOBAL_DAILY = envInt('AI_RATE_GLOBAL_DAILY', 2000);

const perUser = new Map<string, Bucket>();
const global: Bucket = { count: 0, resetAt: Date.now() + DAY };

/** 取桶并在窗口过期时重置。 */
function hit(bucket: Bucket, windowMs: number, now: number): Bucket {
  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  return bucket;
}

// 惰性清理：每次请求顺带扫掉已过期的用户桶，避免 Map 随学号无限增长。
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < HOUR) return;
  lastSweep = now;
  for (const [k, b] of perUser) if (now >= b.resetAt) perUser.delete(k);
}

function tooMany(res: Response, retryAfterMs: number, error: string): void {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  res.status(429).json({ error });
}

/**
 * 限流中间件：挂在所有调用 LLM / TTS 上游的路由上。
 * 必须挂在 gate 之后——它按已认证的 uid 计数。
 */
export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  sweep(now);

  const uid = (req as Request & { user?: TokenPayload }).user?.uid;
  if (!uid) {
    // gate 保证了这里一定已登录；真出现就是挂载顺序错了，按拒绝处理而不是放行。
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  // 先判个人配额：被个人限流挡下的请求不应该扣全站额度。
  let b = perUser.get(uid);
  if (!b) {
    b = { count: 0, resetAt: now + HOUR };
    perUser.set(uid, b);
  }
  hit(b, HOUR, now);
  if (b.count > PER_USER_HOURLY) {
    tooMany(res, b.resetAt - now, `AI 使用过于频繁（每小时上限 ${PER_USER_HOURLY} 次），请稍后再试。`);
    return;
  }

  // 全站每日闸门：钱包保险丝，个别账号没超但整体爆了也要拦。
  const g = hit(global, DAY, now);
  if (g.count > GLOBAL_DAILY) {
    console.warn(`[ratelimit] 全站每日 AI 调用上限 ${GLOBAL_DAILY} 已触顶`);
    tooMany(res, g.resetAt - now, '今日平台 AI 调用额度已用完，请明天再试或联系老师。');
    return;
  }

  next();
}
