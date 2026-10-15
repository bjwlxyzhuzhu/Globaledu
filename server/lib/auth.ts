// 轻量认证：node:crypto 内置实现，免第三方依赖。适合课堂/比赛场景（非银行级）。
// - 密码：scrypt 加盐哈希，存成 `salt:hash`（hex）。
// - 令牌：HMAC-SHA256 签名的无状态 token（payload + 签名），免 session 表。
// 本文件**不引入 db**，保持纯函数，避免 db/index ↔ auth 的循环依赖。
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// —— 密码哈希 ——
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  try {
    const test = scryptSync(plain, salt, 32);
    const ref = Buffer.from(hash, 'hex');
    return test.length === ref.length && timingSafeEqual(test, ref);
  } catch {
    return false;
  }
}

// —— 无状态令牌（HMAC 签名）——
// 已知的不安全取值：代码内置兜底 + .env.example 里的占位串。
// 令牌是无状态 HMAC 且自带 role 字段，密钥一旦可猜，任何人都能伪造 teacher 令牌
// 直通全部 requireAdmin 接口（花名册、成绩、改密码），所以生产必须硬失败而不是继续跑。
const DEV_SECRET = 'huanyu-dev-secret-change-me';
const WEAK_SECRETS = new Set([DEV_SECRET, 'please-change-this-to-a-long-random-string', '']);

// 必须**运行时**读 env，不能在模块顶层读：
// ESM 的 import 会先于 index.ts 的模块体求值，而 .env 是在 index.ts 体内用
// process.loadEnvFile() 加载的。顶层读取会早于它执行，结果是 .env 里的 AUTH_SECRET
// 被静默忽略、回落到上面的开发兜底密钥（Docker 部署因为 compose 用 env_file 注入真环境变量
// 才没暴露这个问题，裸 `pnpm start` 则一直在用可猜的默认密钥签令牌）。
let secretCache: string | null = null;
function getSecret(): string {
  if (secretCache === null) secretCache = process.env.AUTH_SECRET || DEV_SECRET;
  return secretCache;
}

/**
 * 启动自检：在 index.ts 加载完 .env 之后立刻调用。
 * 生产环境密钥不合格直接拒绝启动，开发环境只告警。
 */
export function assertAuthSecret(): void {
  if (!WEAK_SECRETS.has(getSecret())) return;
  const msg = 'AUTH_SECRET 未设置或仍是默认占位值——令牌可被任意伪造，请在 .env 填入一个长随机串。';
  if (process.env.NODE_ENV === 'production') throw new Error(`[auth] ${msg}`);
  console.warn(`[auth] 警告：${msg}（开发模式暂不阻断）`);
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 天

export interface TokenPayload {
  uid: string;
  role: 'student' | 'teacher';
  exp: number;
}

function b64url(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64url');
}
function unb64url(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf-8');
}
function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function signToken(uid: string, role: 'student' | 'teacher'): string {
  const payload: TokenPayload = { uid, role, exp: Date.now() + TOKEN_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  // 时间安全比较签名
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(unb64url(body)) as TokenPayload;
    if (!payload.uid || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// 从请求头/查询取 token（Authorization: Bearer xxx 或 ?token=xxx）
export function tokenFromReq(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  const q = (req.query?.token as string) || '';
  return q || null;
}

// 把已登录用户挂到 req（无类型扩展，用宽松断言）
export function currentUser(req: Request): TokenPayload | null {
  return verifyToken(tokenFromReq(req));
}

// 中间件：需要登录
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const u = currentUser(req);
  if (!u) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  (req as Request & { user: TokenPayload }).user = u;
  next();
}

// 中间件：需要管理员（teacher 角色即管理员）
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const u = currentUser(req);
  if (!u || u.role !== 'teacher') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  (req as Request & { user: TokenPayload }).user = u;
  next();
}
