// 默认拒绝网关：/api/* 一律需要登录，只有下面的白名单例外。
// 这样新增路由默认就是受保护的——忘记挂 requireAuth 不会再导致接口裸奔
// （此前 /api/chat、/api/tts、/api/metrics 等就是这么漏出去的）。
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from './auth';

interface Rule {
  method: 'GET' | 'POST';
  path: RegExp;
}

// 公开白名单：只放行「健康检查 / 登录 / data 目录下的只读内容」。
// 判断标准：该接口既不花钱（不触达 LLM/TTS 上游），也不返回任何学生数据。
const PUBLIC: Rule[] = [
  { method: 'GET', path: /^\/health$/ },
  { method: 'POST', path: /^\/auth\/login$/ },

  // 只读内容：地球/地图/城市图鉴浏览，登录前的主线演示要能走通
  { method: 'GET', path: /^\/countries$/ },
  { method: 'GET', path: /^\/provinces$/ },
  { method: 'GET', path: /^\/citylist$/ },
  { method: 'GET', path: /^\/cities$/ },
  { method: 'GET', path: /^\/capitals$/ },
  { method: 'GET', path: /^\/hanzi$/ },
  { method: 'GET', path: /^\/kb$/ },
  { method: 'GET', path: /^\/geo\/[^/]+$/ },
  { method: 'GET', path: /^\/learn\/[^/]+$/ },
  { method: 'GET', path: /^\/citypedia\/[^/]+$/ },
  { method: 'GET', path: /^\/culture\/local\/[^/]+$/ },

  // 奖励目录：登录与否都能看（与 routes/rewards.ts 的既有约定一致）
  { method: 'GET', path: /^\/rewards$/ },
  { method: 'GET', path: /^\/integration\/manifest$/ },
];

/** 判断某个 (method, path) 是否属于公开白名单。authcheck 脚本复用此函数枚举用例。 */
export function isPublic(method: string, path: string): boolean {
  const m = method.toUpperCase();
  const p = path.replace(/\/+$/, '') || '/';
  return PUBLIC.some((r) => r.method === m && r.path.test(p));
}

/** 挂在所有 /api 路由之前：白名单直接放行，其余交给 requireAuth。 */
export function gate(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    next(); // CORS 预检不带凭据，放行交给 cors 中间件处理
    return;
  }
  if (isPublic(req.method, req.path)) {
    next();
    return;
  }
  requireAuth(req, res, next);
}
