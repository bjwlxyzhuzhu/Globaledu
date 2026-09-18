import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index';
import { requireAdmin, hashPassword, type TokenPayload } from '../lib/auth';
import { shapeWriting } from './writing';

// 管理端：班级管理 + 学生导入（自动建号）+ 花名册/学情聚合。全部需管理员令牌。
const router = Router();

type Row = Record<string, unknown>;
type Stmt = { get: (...a: unknown[]) => Row | undefined; all: (...a: unknown[]) => Row[]; run: (...a: unknown[]) => unknown };
const adminUid = (req: unknown) => (req as { user: TokenPayload }).user.uid;

// 本平台的九个学习模块（与前端 ModuleStage 的 MODULES 对应）
export const ALL_MODULES = [
  'hanzi',
  'listening',
  'speaking',
  'reading',
  'writing',
  'hsk',
  'hskk',
  'culture',
  'culturequiz',
];

// enabled_modules_json → string[]；空数组表示「全部开放」（旧数据即为 '[]'）。
export function parseModules(raw: unknown): string[] {
  try {
    const arr = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(arr) ? arr.filter((x) => ALL_MODULES.includes(String(x))).map(String) : [];
  } catch {
    return [];
  }
}

// GET /api/admin/classes —— 班级列表（含人数）
router.get('/admin/classes', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = (db.prepare('SELECT id, name, hsk_default, enabled_modules_json FROM classes ORDER BY rowid DESC') as Stmt).all();
    const out = rows.map((c) => {
      const n = (db.prepare('SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?') as Stmt).get(c.id);
      const { enabled_modules_json, ...rest } = c;
      return { ...rest, count: (n?.n as number) ?? 0, enabled_modules: parseModules(enabled_modules_json) };
    });
    res.json({ classes: out });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/admin/classes { name, hsk_default }
router.post('/admin/classes', requireAdmin, async (req, res) => {
  const name = String((req.body?.name ?? '') as string).trim();
  const hsk = Number(req.body?.hsk_default) || 3;
  if (!name) {
    res.status(400).json({ error: '请填写班级名称' });
    return;
  }
  try {
    const db = await getDb();
    const id = randomUUID();
    (db.prepare('INSERT INTO classes (id, teacher_id, name, enabled_modules_json, hsk_default) VALUES (?, ?, ?, ?, ?)') as Stmt).run(
      id,
      adminUid(req),
      name,
      '[]',
      hsk,
    );
    res.json({ class: { id, name, hsk_default: hsk, count: 0 } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/admin/classes/:id/import { students: [{ name, student_no, country?, hsk? }] }
// 为每个学号建号（默认密码=学号），加入班级；学号已存在则复用账号。回显初始账号/密码。
router.post('/admin/classes/:id/import', requireAdmin, async (req, res) => {
  const classId = req.params.id;
  const list = Array.isArray(req.body?.students) ? (req.body.students as Row[]) : [];
  if (!list.length) {
    res.status(400).json({ error: '没有可导入的学生（需要 姓名 与 学号）' });
    return;
  }
  try {
    const db = await getDb();
    const cls = (db.prepare('SELECT * FROM classes WHERE id = ?') as Stmt).get(classId);
    if (!cls) {
      res.status(404).json({ error: '班级不存在' });
      return;
    }
    const created: Row[] = [];
    let added = 0;
    let reused = 0;
    for (const s of list) {
      const studentNo = String(s.student_no ?? '').trim();
      const name = String(s.name ?? '').trim() || studentNo;
      if (!studentNo) continue;
      const hsk = Number(s.hsk) || Number(cls.hsk_default) || 3;
      const country = String(s.country ?? '').trim();

      let user = (db.prepare("SELECT * FROM users WHERE student_no = ? AND role = 'student'") as Stmt).get(studentNo);
      let isNew = false;
      if (!user) {
        const uid = randomUUID();
        (db.prepare(
          'INSERT INTO users (id, name, role, country, hsk_level, credits, username, password_hash, student_no, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ) as Stmt).run(uid, name, 'student', country, hsk, 0, studentNo, hashPassword(studentNo), studentNo, Date.now());
        user = { id: uid, name, student_no: studentNo };
        isNew = true;
      }
      // 加入班级（复合主键去重）
      try {
        (db.prepare('INSERT INTO class_members (class_id, user_id) VALUES (?, ?)') as Stmt).run(classId, user.id);
        added += 1;
      } catch {
        /* 已在班级，忽略 */
      }
      if (isNew) created.push({ name, student_no: studentNo, username: studentNo, initialPassword: studentNo });
      else reused += 1;
    }
    res.json({ ok: true, added, reused, createdCount: created.length, created });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/admin/classes/:id/roster —— 花名册 + 学情聚合
router.get('/admin/classes/:id/roster', requireAdmin, async (req, res) => {
  const classId = req.params.id;
  try {
    const db = await getDb();
    const cls = (db.prepare('SELECT * FROM classes WHERE id = ?') as Stmt).get(classId);
    if (!cls) {
      res.status(404).json({ error: '班级不存在' });
      return;
    }
    const members = (db.prepare(
      `SELECT u.* FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? ORDER BY u.student_no`,
    ) as Stmt).all(classId);
    const roster = members.map((u) => {
      const agg = (db.prepare(
        "SELECT AVG(score) AS avg, COUNT(*) AS n FROM learning_records WHERE user_id = ? AND module != 'chat'",
      ) as Stmt).get(u.id);
      return {
        id: u.id,
        name: u.name,
        student_no: u.student_no,
        country: u.country,
        hsk_level: u.hsk_level,
        credits: u.credits ?? 0,
        total_active_sec: u.total_active_sec ?? 0,
        last_login_date: u.last_login_date || '',
        avgScore: agg?.avg != null ? Math.round(Number(agg.avg)) : null,
        records: (agg?.n as number) ?? 0,
      };
    });
    res.json({ class: { id: cls.id, name: cls.name, hsk_default: cls.hsk_default }, roster });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/admin/students/:id —— 单个学生详情（各模块成绩 + 雷达 + 积分明细 + 时长）
router.get('/admin/students/:id', requireAdmin, async (req, res) => {
  const uid = req.params.id;
  try {
    const db = await getDb();
    const u = (db.prepare('SELECT * FROM users WHERE id = ?') as Stmt).get(uid);
    if (!u) {
      res.status(404).json({ error: '学生不存在' });
      return;
    }
    const modules = (db.prepare(
      "SELECT module, MAX(score) AS best, AVG(score) AS avg, COUNT(*) AS n FROM learning_records WHERE user_id = ? AND module != 'chat' GROUP BY module ORDER BY module",
    ) as Stmt).all(uid).map((r) => ({
      module: r.module,
      best: Math.round(Number(r.best) || 0),
      avg: Math.round(Number(r.avg) || 0),
      count: (r.n as number) ?? 0,
    }));
    const radar = (db.prepare('SELECT dim, score FROM ability_scores WHERE user_id = ?') as Stmt).all(uid).map((r) => ({
      dim: r.dim,
      score: Math.round(Number(r.score) || 0),
    }));
    const points = (db.prepare(
      'SELECT type, points, ts FROM point_events WHERE user_id = ? ORDER BY ts DESC LIMIT 50',
    ) as Stmt).all(uid);
    res.json({
      student: {
        id: u.id,
        name: u.name,
        student_no: u.student_no,
        country: u.country,
        hsk_level: u.hsk_level,
        credits: u.credits ?? 0,
        total_active_sec: u.total_active_sec ?? 0,
        last_login_date: u.last_login_date || '',
      },
      modules,
      radar,
      points,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/admin/students/:id/reset-password { newPassword? } —— 找回密码：重置为新密码（默认=学号）
router.post('/admin/students/:id/reset-password', requireAdmin, async (req, res) => {
  const uid = req.params.id;
  try {
    const db = await getDb();
    const u = (db.prepare('SELECT student_no FROM users WHERE id = ?') as Stmt).get(uid);
    if (!u) {
      res.status(404).json({ error: '学生不存在' });
      return;
    }
    const pwd = String((req.body?.newPassword ?? '') as string).trim() || String(u.student_no || '') || '123456';
    (db.prepare('UPDATE users SET password_hash = ? WHERE id = ?') as Stmt).run(hashPassword(pwd), uid);
    res.json({ ok: true, newPassword: pwd });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/admin/redemptions —— 兑换记录（待发放在前），含学生姓名/学号
router.get('/admin/redemptions', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = (db.prepare(
      `SELECT r.id, r.reward_id, r.reward_name, r.cost, r.status, r.ts, u.name, u.student_no
       FROM redemptions r JOIN users u ON u.id = r.user_id
       ORDER BY (r.status = 'pending') DESC, r.ts DESC LIMIT 300`,
    ) as Stmt).all();
    res.json({ redemptions: rows });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/admin/redemptions/:id/fulfill —— 标记某兑换为已发放
router.post('/admin/redemptions/:id/fulfill', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    (db.prepare("UPDATE redemptions SET status = 'fulfilled' WHERE id = ?") as Stmt).run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/admin/students/:id/writings —— 某学生的写作记录（原文 + 批改），供教师查看学情
router.get('/admin/students/:id/writings', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const rows = (db.prepare(
      'SELECT id, item_id, title, prompt, text, score, dims_json, corrections_json, comment_zh, ts FROM writings WHERE user_id = ? ORDER BY ts DESC LIMIT 50',
    ) as Stmt).all(req.params.id);
    res.json({ writings: rows.map(shapeWriting) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/admin/classes/:id { name?, hsk_default?, enabled_modules? } —— 改名 / 改默认等级 / 模块开关
router.post('/admin/classes/:id', requireAdmin, async (req, res) => {
  const name = String((req.body?.name ?? '') as string).trim();
  const hsk = Number(req.body?.hsk_default);
  const mods = Array.isArray(req.body?.enabled_modules)
    ? (req.body.enabled_modules as unknown[]).map(String).filter((m) => ALL_MODULES.includes(m))
    : null;
  try {
    const db = await getDb();
    const cls = (db.prepare('SELECT * FROM classes WHERE id = ?') as Stmt).get(req.params.id);
    if (!cls) {
      res.status(404).json({ error: '班级不存在' });
      return;
    }
    const nextName = name || String(cls.name);
    const nextHsk = hsk >= 1 && hsk <= 6 ? hsk : Number(cls.hsk_default) || 3;
    const nextMods = mods ?? parseModules(cls.enabled_modules_json);
    (db.prepare('UPDATE classes SET name = ?, hsk_default = ?, enabled_modules_json = ? WHERE id = ?') as Stmt).run(
      nextName,
      nextHsk,
      JSON.stringify(nextMods),
      req.params.id,
    );
    res.json({ class: { id: req.params.id, name: nextName, hsk_default: nextHsk, enabled_modules: nextMods } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/admin/classes/:id —— 删除班级（只删班级与成员关系，学生账号与学习数据保留）
router.delete('/admin/classes/:id', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const cls = (db.prepare('SELECT * FROM classes WHERE id = ?') as Stmt).get(req.params.id);
    if (!cls) {
      res.status(404).json({ error: '班级不存在' });
      return;
    }
    const n = (db.prepare('SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?') as Stmt).get(req.params.id);
    (db.prepare('DELETE FROM class_members WHERE class_id = ?') as Stmt).run(req.params.id);
    (db.prepare('DELETE FROM classes WHERE id = ?') as Stmt).run(req.params.id);
    res.json({ ok: true, removedMembers: (n?.n as number) ?? 0 });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/admin/classes/:id/members/:uid —— 把学生移出班级（账号与数据保留，可再次导入）
router.delete('/admin/classes/:id/members/:uid', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    (db.prepare('DELETE FROM class_members WHERE class_id = ? AND user_id = ?') as Stmt).run(req.params.id, req.params.uid);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 学生活动痕迹统计：用于判断账号能否彻底删除（只允许删「建错的空账号」）
const ACTIVITY_TABLES: { table: string; label: string }[] = [
  { table: 'point_events', label: '积分记录' },
  { table: 'learning_records', label: '学习记录' },
  { table: 'writings', label: '写作记录' },
  { table: 'chat_sessions', label: '对话记录' },
  { table: 'certificates', label: '证书' },
  { table: 'redemptions', label: '兑换记录' },
  { table: 'documents', label: '生成文档' },
  { table: 'ability_scores', label: '能力评分' },
];

function activityOf(db: { prepare: (s: string) => Stmt }, uid: string): string[] {
  const found: string[] = [];
  for (const t of ACTIVITY_TABLES) {
    try {
      const r = db.prepare(`SELECT COUNT(*) AS n FROM ${t.table} WHERE user_id = ?`).get(uid);
      if (((r?.n as number) ?? 0) > 0) found.push(t.label);
    } catch {
      /* 表不存在则忽略 */
    }
  }
  return found;
}

// DELETE /api/admin/students/:uid —— 彻底删除账号。仅当该学生没有任何学习痕迹时允许（防误删真实数据）。
router.delete('/admin/students/:uid', requireAdmin, async (req, res) => {
  const uid = req.params.uid;
  try {
    const db = await getDb();
    const u = (db.prepare("SELECT id, name, student_no FROM users WHERE id = ? AND role = 'student'") as Stmt).get(uid);
    if (!u) {
      res.status(404).json({ error: '学生不存在' });
      return;
    }
    const activity = activityOf(db as unknown as { prepare: (s: string) => Stmt }, uid);
    if (activity.length) {
      res.status(409).json({
        error: `该学生已有${activity.join('、')}，不能彻底删除。可先「移出班级」，数据将保留。`,
        activity,
      });
      return;
    }
    (db.prepare('DELETE FROM class_members WHERE user_id = ?') as Stmt).run(uid);
    (db.prepare('DELETE FROM users WHERE id = ?') as Stmt).run(uid);
    res.json({ ok: true, deleted: { name: u.name, student_no: u.student_no } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/admin/classes/:id/reset-passwords { userIds? } —— 批量重置为学号，返回可打印的发放清单
router.post('/admin/classes/:id/reset-passwords', requireAdmin, async (req, res) => {
  const ids = Array.isArray(req.body?.userIds) ? (req.body.userIds as string[]) : [];
  try {
    const db = await getDb();
    const members = (db.prepare(
      `SELECT u.id, u.name, u.student_no FROM class_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.class_id = ? AND u.role = 'student'`,
    ) as Stmt).all(req.params.id);
    const target = ids.length ? members.filter((m) => ids.includes(String(m.id))) : members;
    const out: Row[] = [];
    for (const m of target) {
      const pwd = String(m.student_no || '') || '123456';
      (db.prepare('UPDATE users SET password_hash = ? WHERE id = ?') as Stmt).run(hashPassword(pwd), m.id);
      out.push({ name: m.name, student_no: m.student_no, password: pwd });
    }
    res.json({ ok: true, count: out.length, list: out });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
