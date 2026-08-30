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

// GET /api/admin/classes —— 班级列表（含人数）
router.get('/admin/classes', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = (db.prepare('SELECT id, name, hsk_default FROM classes ORDER BY rowid DESC') as Stmt).all();
    const out = rows.map((c) => {
      const n = (db.prepare('SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?') as Stmt).get(c.id);
      return { ...c, count: (n?.n as number) ?? 0 };
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

export default router;
