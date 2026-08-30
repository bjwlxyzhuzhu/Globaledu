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
const SECRET = process.env.AUTH_SECRET || 'huanyu-dev-secret-change-me';
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
  return createHmac('sha256', SECRET).update(data).digest('base64url');
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
