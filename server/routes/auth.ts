import { Router } from 'express';
import { getDb } from '../db/index';
import { verifyPassword, signToken, currentUser, hashPassword } from '../lib/auth';
import { award } from '../lib/points';

// 认证路由：学生(学号+密码) / 管理员(账号+密码) 登录、当前用户、心跳计时。
const router = Router();

type Row = Record<string, unknown>;
type Stmt = { get: (...a: unknown[]) => Row | undefined; run: (...a: unknown[]) => unknown };

// 去敏后的用户对象（前端用）
function userPublic(u: Row) {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    username: u.username,
    student_no: u.student_no,
    country: u.country,
    native_lang: u.native_lang,
    hsk_level: u.hsk_level,
    credits: u.credits ?? 0,
    total_active_sec: u.total_active_sec ?? 0,
  };
}

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// 心跳基线：记录每个用户上次心跳时刻，间隔封顶 90s，防刷。
const lastBeat = new Map<string, number>();

// POST /api/auth/login { account, password, as: 'student'|'admin' }
router.post('/auth/login', async (req, res) => {
  const account = String((req.body?.account ?? '') as string).trim();
  const password = String((req.body?.password ?? '') as string);
  const as = (req.body?.as as string) === 'admin' ? 'admin' : 'student';
  if (!account || !password) {
    res.status(400).json({ error: '请输入账号和密码' });
    return;
  }
  try {
    const db = await getDb();
    let row: Row | undefined;
    if (as === 'admin') {
      row = (db.prepare("SELECT * FROM users WHERE username = ? AND role = 'teacher'") as Stmt).get(account);
    } else {
      row = (db.prepare(
        "SELECT * FROM users WHERE (student_no = ? OR username = ?) AND role = 'student'",
      ) as Stmt).get(account, account);
    }
    if (!row || !verifyPassword(password, row.password_hash as string)) {
      res.status(401).json({ error: '账号或密码不正确' });
      return;
    }

    // 登录积分：首登 +20；之后每日首次 +10；当天重复登录不发分。
    const uid = row.id as string;
    const last = (row.last_login_date as string) || '';
    let awarded = 0;
    let awardType = '';
    if (!last) {
      awarded = award(db, uid, 'register');
      awardType = 'register';
    } else if (last !== today()) {
      awarded = award(db, uid, 'daily');
      awardType = 'daily';
    }
    (db.prepare('UPDATE users SET last_login_date = ? WHERE id = ?') as Stmt).run(today(), uid);

    // 重新取一次（积分已更新）
    const fresh = (db.prepare('SELECT * FROM users WHERE id = ?') as Stmt).get(uid)!;
    const token = signToken(uid, row.role as 'student' | 'teacher');
    res.json({ token, user: userPublic(fresh), awarded, awardType });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/auth/me —— 用 token 取当前用户（前端启动校验）
router.get('/auth/me', async (req, res) => {
  const u = currentUser(req);
  if (!u) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const db = await getDb();
    const row = (db.prepare('SELECT * FROM users WHERE id = ?') as Stmt).get(u.uid);
    if (!row) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ user: userPublic(row) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/auth/heartbeat —— 累计互动时长（间隔封顶 90s）
router.post('/auth/heartbeat', async (req, res) => {
  const u = currentUser(req);
  if (!u) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const now = Date.now();
  const prev = lastBeat.get(u.uid);
  lastBeat.set(u.uid, now);
  const add = prev ? Math.min(Math.round((now - prev) / 1000), 90) : 30; // 首次心跳给 30s 基线
  try {
    const db = await getDb();
    (db.prepare('UPDATE users SET total_active_sec = COALESCE(total_active_sec, 0) + ? WHERE id = ?') as Stmt).run(
      add,
      u.uid,
    );
    const row = (db.prepare('SELECT total_active_sec FROM users WHERE id = ?') as Stmt).get(u.uid);
    res.json({ ok: true, total_active_sec: row?.total_active_sec ?? 0 });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/auth/change-password —— 登录用户自助改密码（需验证旧密码）
router.post('/auth/change-password', async (req, res) => {
  const u = currentUser(req);
  if (!u) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const oldPassword = String((req.body?.oldPassword ?? '') as string);
  const newPassword = String((req.body?.newPassword ?? '') as string);
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: '新密码至少 4 位' });
    return;
  }
  try {
    const db = await getDb();
    const row = (db.prepare('SELECT password_hash FROM users WHERE id = ?') as Stmt).get(u.uid);
    if (!row || !verifyPassword(oldPassword, row.password_hash as string)) {
      res.status(401).json({ error: '旧密码不正确' });
      return;
    }
    (db.prepare('UPDATE users SET password_hash = ? WHERE id = ?') as Stmt).run(hashPassword(newPassword), u.uid);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
