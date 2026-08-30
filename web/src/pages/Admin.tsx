import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import GuidedTour, { type TourStep } from '../components/GuidedTour';
import type { ClassInfo, RosterRow, StudentDetail, Redemption, WritingRecord } from '@shared/types';

// 管理后台功能导览
const ADMIN_TOUR: TourStep[] = [
  { sel: '[data-tour="a-view"]', title: { zh: '🛠 两大管理视图', en: 'Two admin views' }, desc: { zh: '「班级管理」管学生与学情，「兑换管理」处理学生用积分兑换的奖励并标记发放。', en: 'Class management for students and progress; redemption management to fulfill reward redemptions.' } },
  { sel: '[data-tour="a-newclass"]', title: { zh: '➕ 新建班级 + 导入', en: 'New class + import' }, desc: { zh: '先新建班级，再在右侧「导入学生」上传 Excel 名单，一键批量建号（用户名=学号，初始密码=学号，可重置）。', en: 'Create a class, then import students from an Excel roster — accounts are created in bulk (initial password = student ID).' } },
  { sel: '[data-tour="a-roster"]', title: { zh: '📊 花名册与学情', en: 'Roster & progress' }, desc: { zh: '花名册显示每个学生的积分、互动时长、平均分；点某行可看其成绩、能力雷达、积分明细与写作批改。还能导出 Excel / PDF。', en: 'See points, active time and scores per student; click a row for radar, points and graded writing. Export to Excel / PDF.' } },
];

// 互动时长：秒 → 「X分Y秒」
function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  return `${m}分${s % 60}秒`;
}

const DIM_LABEL: Record<string, string> = {
  listen: '听力',
  speak: '口语',
  read: '阅读',
  write: '写作',
  hanzi: '汉字',
  culture: '文化',
  hskk: 'HSKK',
};
const MOD_LABEL: Record<string, string> = {
  listening: '听力',
  speaking: '口语',
  reading: '阅读',
  hsk: 'HSK 模考',
  hanzi: '汉字闯关',
  culturequiz: '文化闯关',
  cityquiz: '城市出题',
  hskk: 'HSKK 口试',
};

type ImportRow = { name: string; student_no: string; country?: string; hsk?: number };

// 管理后台：班级管理 + 学生导入(Excel) + 花名册 + 学情导出(Excel/PDF) + 学生详情。
export default function Admin() {
  const nav = useNavigate();
  const user = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sel, setSel] = useState<ClassInfo | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [newName, setNewName] = useState('');
  const [newHsk, setNewHsk] = useState(3);

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importMsg, setImportMsg] = useState('');
  const [created, setCreated] = useState<{ name: string; student_no: string; initialPassword: string }[]>([]);

  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailWritings, setDetailWritings] = useState<WritingRecord[]>([]);
  const [openWriting, setOpenWriting] = useState<string | null>(null);
  const [pwdReset, setPwdReset] = useState('');

  const [view, setView] = useState<'classes' | 'redeem'>('classes');
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  // 守卫：仅管理员可进
  useEffect(() => {
    if (user && user.role !== 'teacher') nav('/globe');
    if (!user) nav('/login');
  }, [user, nav]);

  // 兑换管理：进入该视图时拉取兑换记录
  useEffect(() => {
    if (view === 'redeem') api.adminRedemptions().then((r) => setRedemptions(r.redemptions)).catch((e) => setErr((e as Error).message));
  }, [view]);

  const resetPwd = async (id: string) => {
    setPwdReset('');
    try {
      const r = await api.adminResetPassword(id);
      setPwdReset(`已重置，新密码：${r.newPassword}（请转告学生，登录后可自改）`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const fulfill = async (id: string) => {
    try {
      await api.adminFulfill(id);
      setRedemptions((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'fulfilled' } : r)));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const loadClasses = () => {
    api
      .adminClasses()
      .then((r) => setClasses(r.classes))
      .catch((e) => setErr((e as Error).message));
  };
  useEffect(loadClasses, []);

  const openClass = (c: ClassInfo) => {
    setSel(c);
    setCreated([]);
    setImportRows([]);
    setImportMsg('');
    setLoading(true);
    api
      .adminRoster(c.id)
      .then((r) => setRoster(r.roster))
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };

  const createClass = async () => {
    if (!newName.trim()) return;
    try {
      const r = await api.adminCreateClass({ name: newName.trim(), hsk_default: newHsk });
      setNewName('');
      setClasses((cs) => [r.class, ...cs]);
      openClass(r.class);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // 解析上传的 .xlsx：支持中/英表头（姓名/name、学号/student_no/id、国家/country、HSK）。
  const onFile = async (file: File) => {
    setImportMsg('');
    setCreated([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const rows: ImportRow[] = [];
      for (const r of raw) {
        const get = (keys: string[]) => {
          for (const k of Object.keys(r)) {
            const kk = k.trim().toLowerCase();
            if (keys.some((x) => kk === x || kk.includes(x))) return String(r[k]).trim();
          }
          return '';
        };
        const student_no = get(['学号', 'student_no', 'studentno', 'id', '学籍号']);
        const name = get(['姓名', 'name', '名字']) || student_no;
        const country = get(['国家', 'country', '国籍']);
        const hskStr = get(['hsk', '级别', '等级']);
        if (!student_no) continue;
        rows.push({ name, student_no, country, hsk: Number(hskStr) || undefined });
      }
      if (!rows.length) {
        setImportMsg('未在表格中识别到学号列（需要「学号」或「student_no」表头）。');
        return;
      }
      setImportRows(rows);
      setImportMsg(`已解析 ${rows.length} 名学生，确认无误后点「导入」。`);
    } catch (e) {
      setImportMsg('解析失败：' + (e as Error).message);
    }
  };

  const doImport = async () => {
    if (!sel || !importRows.length) return;
    try {
      const r = await api.adminImport(sel.id, importRows);
      setImportMsg(`导入完成：新建 ${r.createdCount} 个账号，复用 ${r.reused} 个，已加入班级。`);
      setCreated(r.created);
      setImportRows([]);
      openClass(sel); // 刷新花名册
    } catch (e) {
      setImportMsg('导入失败：' + (e as Error).message);
    }
  };

  // 导出花名册为 Excel（SheetJS，中文原生支持）
  const exportExcel = () => {
    if (!sel) return;
    const data = roster.map((s) => ({
      姓名: s.name,
      学号: s.student_no || '',
      国家: s.country || '',
      HSK等级: s.hsk_level || '',
      积分: s.credits,
      互动时长: fmtTime(s.total_active_sec),
      互动时长秒: s.total_active_sec,
      平均成绩: s.avgScore ?? '',
      学习记录数: s.records,
      最近登录: s.last_login_date || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '花名册');
    XLSX.writeFile(wb, `${sel.name}_花名册_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 导出 PDF：开新窗口写打印视图，调用浏览器「打印 → 另存为 PDF」（中文最稳）
  const exportPdf = () => {
    if (!sel) return;
    const rowsHtml = roster
      .map(
        (s, i) =>
          `<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.student_no || ''}</td><td>${s.country || ''}</td><td>${
            s.hsk_level || ''
          }</td><td>${s.credits}</td><td>${fmtTime(s.total_active_sec)}</td><td>${s.avgScore ?? '-'}</td><td>${
            s.records
          }</td><td>${s.last_login_date || '-'}</td></tr>`,
      )
      .join('');
    const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>${sel.name} 花名册</title>
<style>body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;padding:24px;color:#222}
h1{font-size:18px}p{color:#666;font-size:12px}
table{border-collapse:collapse;width:100%;margin-top:12px;font-size:12px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:center}th{background:#f0f4ff}
@media print{button{display:none}}</style></head>
<body><h1>${sel.name} · 学情花名册</h1>
<p>导出时间：${new Date().toLocaleString('zh-CN')} · 共 ${roster.length} 名学生 · 寰语星球</p>
<button onclick="window.print()" style="margin:8px 0;padding:6px 14px">🖨 打印 / 另存为 PDF</button>
<table><thead><tr><th>#</th><th>姓名</th><th>学号</th><th>国家</th><th>HSK</th><th>积分</th><th>互动时长</th><th>平均分</th><th>记录数</th><th>最近登录</th></tr></thead>
<tbody>${rowsHtml}</tbody></table>
<script>setTimeout(function(){window.print()},400)</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const openStudent = (id: string) => {
    setPwdReset('');
    setDetailWritings([]);
    setOpenWriting(null);
    api
      .adminStudent(id)
      .then(setDetail)
      .catch((e) => setErr((e as Error).message));
    api
      .adminStudentWritings(id)
      .then((r) => setDetailWritings(r.writings))
      .catch(() => setDetailWritings([]));
  };

  const totalStudents = useMemo(() => classes.reduce((n, c) => n + c.count, 0), [classes]);

  return (
    <div className="min-h-screen px-4 sm:px-8 py-6 max-w-6xl mx-auto">
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-glow">🛠 管理后台</h1>
          <p className="text-xs text-white/45 mt-0.5">
            {user?.name || '管理员'} · 班级 {classes.length} 个 · 学生 {totalStudents} 人
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/globe')} className="px-3 py-1.5 rounded-lg glass text-xs hover:border-starcyan/60">
            🌐 进入学习
          </button>
          <button
            onClick={() => {
              logout();
              nav('/login');
            }}
            className="px-3 py-1.5 rounded-lg glass text-xs hover:border-red-400/60"
          >
            退出登录
          </button>
        </div>
      </div>

      {err && <p className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2 mb-4">{err}</p>}

      {/* 视图切换 */}
      <div data-tour="a-view" className="flex rounded-xl bg-space-800/70 border border-white/10 p-1 mb-5 text-sm max-w-xs">
        {([['classes', '🏫 班级管理'], ['redeem', '🎁 兑换管理']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={'flex-1 py-2 rounded-lg transition ' + (view === k ? 'bg-starcyan/20 text-starcyan font-semibold' : 'text-white/60 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'redeem' && (
        <div className="glass rounded-2xl p-4">
          <h2 className="text-base font-semibold mb-3">积分兑换记录 <span className="text-xs text-white/45">· 待发放在前</span></h2>
          {redemptions.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">还没有学生兑换记录。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/45 text-xs border-b border-white/10">
                    <th className="text-left py-2 px-2">学生</th>
                    <th className="text-left px-2">学号</th>
                    <th className="text-left px-2">奖励</th>
                    <th className="px-2">花费</th>
                    <th className="px-2">时间</th>
                    <th className="px-2">状态</th>
                    <th className="px-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="py-2 px-2 text-white/90">{r.name}</td>
                      <td className="px-2 text-white/60">{r.student_no || '-'}</td>
                      <td className="px-2 text-white/80">{r.reward_name}</td>
                      <td className="px-2 text-center text-gold">{r.cost}💎</td>
                      <td className="px-2 text-center text-white/45 text-xs">{new Date(r.ts).toLocaleString('zh-CN')}</td>
                      <td className="px-2 text-center">
                        <span className={'text-[11px] px-2 py-0.5 rounded-full ' + (r.status === 'fulfilled' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300')}>
                          {r.status === 'fulfilled' ? '已发放' : '待发放'}
                        </span>
                      </td>
                      <td className="px-2 text-center">
                        {r.status === 'pending' && (
                          <button onClick={() => fulfill(r.id)} className="btn-primary px-3 py-1 rounded-lg text-xs">标记发放</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'classes' && (
      <div className="grid md:grid-cols-[260px_1fr] gap-5">
        {/* 左：班级列表 + 新建 */}
        <div className="glass rounded-2xl p-4 h-max">
          <h2 className="text-sm font-semibold mb-3">班级</h2>
          <div className="space-y-1.5 mb-4">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => openClass(c)}
                className={
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition ' +
                  (sel?.id === c.id ? 'bg-starcyan/20 text-starcyan' : 'hover:bg-white/5 text-white/80')
                }
              >
                {c.name}
                <span className="text-xs text-white/40 ml-1">· {c.count}人 · HSK{c.hsk_default}</span>
              </button>
            ))}
            {classes.length === 0 && <p className="text-xs text-white/40">还没有班级，先新建一个。</p>}
          </div>
          <div data-tour="a-newclass" className="border-t border-white/10 pt-3 space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新班级名称，如 2026春A班"
              className="w-full bg-space-800 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-starcyan/60"
            />
            <div className="flex gap-2">
              <select
                value={newHsk}
                onChange={(e) => setNewHsk(Number(e.target.value))}
                className="bg-space-800 border border-white/15 rounded-lg px-2 py-2 text-sm outline-none"
              >
                {[1, 2, 3, 4, 5, 6].map((h) => (
                  <option key={h} value={h}>
                    默认 HSK{h}
                  </option>
                ))}
              </select>
              <button onClick={createClass} className="btn-primary flex-1 rounded-lg text-sm py-2">
                ＋ 新建班级
              </button>
            </div>
          </div>
        </div>

        {/* 右：花名册 + 导入导出 */}
        <div data-tour="a-roster" className="glass rounded-2xl p-4 min-h-[300px]">
          {!sel ? (
            <div className="grid place-items-center h-full text-white/40 text-sm py-16">← 选择或新建一个班级</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-base font-semibold">
                  {sel.name} <span className="text-xs text-white/45">· {roster.length} 名学生</span>
                </h2>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg glass text-xs hover:border-gold/60 cursor-pointer">
                    📥 导入学生(Excel)
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                    />
                  </label>
                  <button onClick={exportExcel} disabled={!roster.length} className="px-3 py-1.5 rounded-lg glass text-xs hover:border-starcyan/60 disabled:opacity-40">
                    📊 导出 Excel
                  </button>
                  <button onClick={exportPdf} disabled={!roster.length} className="px-3 py-1.5 rounded-lg glass text-xs hover:border-starcyan/60 disabled:opacity-40">
                    🖨 导出 PDF
                  </button>
                </div>
              </div>

              {/* 导入预览 / 结果 */}
              {importMsg && <p className="text-xs text-gold bg-gold/10 rounded-lg px-3 py-2 mb-3">{importMsg}</p>}
              {importRows.length > 0 && (
                <div className="mb-3 text-xs text-white/70">
                  <div className="max-h-28 overflow-auto rounded-lg border border-white/10 p-2 mb-2">
                    {importRows.slice(0, 50).map((r, i) => (
                      <span key={i} className="inline-block bg-white/5 rounded px-2 py-0.5 m-0.5">
                        {r.name}（{r.student_no}）
                      </span>
                    ))}
                  </div>
                  <button onClick={doImport} className="btn-primary rounded-lg text-sm px-4 py-1.5">
                    ✅ 确认导入 {importRows.length} 人
                  </button>
                </div>
              )}
              {created.length > 0 && (
                <div className="mb-3 text-xs">
                  <p className="text-white/70 mb-1">新建账号（初始密码＝学号，请提醒学生登录后修改）：</p>
                  <div className="max-h-28 overflow-auto rounded-lg border border-gold/20 bg-gold/5 p-2">
                    {created.map((c, i) => (
                      <div key={i} className="text-white/75">
                        {c.name}：账号 <b className="text-gold">{c.student_no}</b> / 密码 <b className="text-gold">{c.initialPassword}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 花名册表 */}
              {loading ? (
                <p className="text-white/40 text-sm py-8 text-center">加载中…</p>
              ) : roster.length === 0 ? (
                <p className="text-white/40 text-sm py-8 text-center">本班还没有学生，点「导入学生」上传 Excel 名单。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/45 text-xs border-b border-white/10">
                        <th className="text-left py-2 px-2">姓名</th>
                        <th className="text-left px-2">学号</th>
                        <th className="px-2">国家</th>
                        <th className="px-2">积分</th>
                        <th className="px-2">互动时长</th>
                        <th className="px-2">平均分</th>
                        <th className="px-2">最近登录</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => openStudent(s.id)}
                          className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                        >
                          <td className="py-2 px-2 text-white/90">{s.name}</td>
                          <td className="px-2 text-white/60">{s.student_no || '-'}</td>
                          <td className="px-2 text-center text-white/60">{s.country || '-'}</td>
                          <td className="px-2 text-center text-gold">{s.credits}💎</td>
                          <td className="px-2 text-center text-white/70">{fmtTime(s.total_active_sec)}</td>
                          <td className="px-2 text-center text-starcyan">{s.avgScore ?? '-'}</td>
                          <td className="px-2 text-center text-white/50 text-xs">{s.last_login_date || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-white/35 mt-2">点击某行查看该学生的成绩、能力雷达与积分明细。</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      )}

      {/* 学生详情弹层 */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setDetail(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">
                {detail.student.name} <span className="text-xs text-white/45">学号 {detail.student.student_no}</span>
              </h3>
              <button onClick={() => setDetail(null)} className="text-white/50 hover:text-white text-xl">
                ×
              </button>
            </div>
            <div className="flex gap-4 text-sm mb-3 flex-wrap items-center">
              <span className="text-gold">{detail.student.credits}💎 积分</span>
              <span className="text-white/70">互动 {fmtTime(detail.student.total_active_sec)}</span>
              <span className="text-white/50">最近登录 {detail.student.last_login_date || '-'}</span>
              <button onClick={() => resetPwd(detail.student.id)} className="ml-auto glass px-3 py-1 rounded-lg text-xs hover:border-amber-400/60">🔑 重置密码</button>
            </div>
            {pwdReset && <p className="text-xs text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2 mb-3">{pwdReset}</p>}

            <h4 className="text-xs text-white/50 mb-1">能力雷达</h4>
            <div className="space-y-1 mb-4">
              {detail.radar.length === 0 && <p className="text-xs text-white/40">暂无能力数据（学生尚未做题）。</p>}
              {detail.radar.map((r) => (
                <div key={r.dim} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-white/60">{DIM_LABEL[r.dim] || r.dim}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-starcyan/70" style={{ width: `${Math.min(100, r.score)}%` }} />
                  </div>
                  <span className="w-8 text-right text-starcyan">{r.score}</span>
                </div>
              ))}
            </div>

            <h4 className="text-xs text-white/50 mb-1">各模块成绩</h4>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {detail.modules.length === 0 && <p className="text-xs text-white/40 col-span-2">暂无成绩记录。</p>}
              {detail.modules.map((m) => (
                <div key={m.module} className="bg-white/5 rounded-lg px-3 py-2 text-xs">
                  <div className="text-white/80">{MOD_LABEL[m.module] || m.module}</div>
                  <div className="text-white/50">
                    最佳 <b className="text-gold">{m.best}</b> · 平均 {m.avg} · {m.count} 次
                  </div>
                </div>
              ))}
            </div>

            <h4 className="text-xs text-white/50 mb-1">积分明细（近 50 条）</h4>
            <div className="max-h-32 overflow-auto text-xs space-y-0.5">
              {detail.points.length === 0 && <p className="text-white/40">暂无积分记录。</p>}
              {detail.points.map((p, i) => (
                <div key={i} className="flex justify-between text-white/60">
                  <span>
                    {{ register: '首次登录', daily: '每日登录', learn: '完成学习', chat: '智能体对话' }[p.type] || p.type}
                  </span>
                  <span className="text-gold">+{p.points}</span>
                  <span className="text-white/35">{new Date(p.ts).toLocaleString('zh-CN')}</span>
                </div>
              ))}
            </div>

            {/* 写作记录：学生作文原文 + AI 批改 */}
            <h4 className="text-xs text-white/50 mb-1 mt-4">✍️ 写作记录（{detailWritings.length}）</h4>
            {detailWritings.length === 0 ? (
              <p className="text-xs text-white/40">该学生还没有写作记录。</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-auto">
                {detailWritings.map((wr) => (
                  <div key={wr.id} className="bg-white/5 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setOpenWriting((id) => (id === wr.id ? null : wr.id))}
                      className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-white/5"
                    >
                      <span className="text-white/85">{wr.title || '写作'}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-gold font-semibold">{wr.score}</span>
                        <span className="text-white/35">{new Date(wr.ts).toLocaleDateString('zh-CN')}</span>
                      </span>
                    </button>
                    {openWriting === wr.id && (
                      <div className="px-3 pb-2.5 border-t border-white/10 pt-2">
                        {wr.prompt && <p className="text-[11px] text-white/45 mb-1">题目：{wr.prompt}</p>}
                        <p className="text-xs text-white/85 leading-relaxed whitespace-pre-wrap bg-space-900/50 rounded-lg px-2.5 py-2">{wr.text}</p>
                        <div className="flex gap-2.5 flex-wrap mt-1.5 text-[11px] text-white/55">
                          <span>内容 {wr.dims.content}</span>
                          <span>语法 {wr.dims.grammar}</span>
                          <span>词汇 {wr.dims.vocab}</span>
                          <span>连贯 {wr.dims.coherence}</span>
                        </div>
                        {wr.comment_zh && <p className="text-[11px] text-white/65 mt-1.5 leading-relaxed">🎓 {wr.comment_zh}</p>}
                        {wr.corrections.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {wr.corrections.map((c, i) => (
                              <div key={i} className="text-[11px]">
                                <span className="text-red-300/90 line-through">{c.original}</span>
                                <span className="mx-1 text-white/40">→</span>
                                <span className="text-emerald-300">{c.fixed}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <GuidedTour id="admin" steps={ADMIN_TOUR} />
    </div>
  );
}
