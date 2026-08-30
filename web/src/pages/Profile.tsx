import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';

// 简易 SVG 能力雷达（多维 0~100）
function Radar({ dims, size = 300 }: { dims: { label: string; value: number }[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 38;
  const n = dims.length;
  const pt = (i: number, frac: number) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return [cx + r * frac * Math.cos(a), cy + r * frac * Math.sin(a)];
  };
  const poly = dims.map((d, i) => pt(i, Math.max(0.02, d.value / 100)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px] mx-auto">
      {[0.25, 0.5, 0.75, 1].map((f, k) => (
        <polygon key={k} points={dims.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.12)" />
      ))}
      {dims.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.12)" />;
      })}
      <polygon points={poly} fill="rgba(63,210,255,0.28)" stroke="#3fd2ff" strokeWidth={2} />
      {dims.map((d, i) => {
        const [x, y] = pt(i, 1.18);
        return (
          <text key={i} x={x} y={y} fontSize={11} fill="rgba(255,255,255,0.8)" textAnchor="middle" dominantBaseline="middle">
            {d.label} {d.value}
          </text>
        );
      })}
    </svg>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const hanziProgress = useStore((s) => s.hanziProgress);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const hskLevel = useStore((s) => s.hskLevel);
  const currentUser = useStore((s) => s.currentUser);
  const [chatTurns, setChatTurns] = useState(0);
  const [name, setName] = useState('');
  const certRef = useRef<HTMLCanvasElement>(null);

  // 改密码表单
  const [showPwd, setShowPwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => {
    api.metrics().then((m) => setChatTurns(m.count || 0)).catch(() => {});
  }, []);

  // 登录用户：用账户名预填证书姓名
  useEffect(() => {
    if (currentUser?.name) setName((n) => n || currentUser.name);
  }, [currentUser]);

  const changePwd = async () => {
    setPwdMsg('');
    if (newPwd.length < 4) {
      setPwdMsg('新密码至少 4 位');
      return;
    }
    try {
      await api.changePassword({ oldPassword: oldPwd, newPassword: newPwd });
      setPwdMsg('✅ 密码已修改');
      setOldPwd('');
      setNewPwd('');
      setTimeout(() => setShowPwd(false), 1200);
    } catch (e) {
      setPwdMsg((e as Error).message);
    }
  };

  const dims = useMemo(() => {
    const avg = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0);
    const mod = (m: string) => Object.entries(moduleProgress).filter(([k]) => k.startsWith(m + ':')).map(([, v]) => v);
    const hz = Object.values(hanziProgress);
    const writeScores = mod('writing'); // 写作模块真实成绩；无则回退按汉字掌握数估算
    return [
      { key: 'listen', value: avg(mod('listening')) },
      { key: 'speak', value: avg(mod('speaking')) },
      { key: 'read', value: avg(mod('reading')) },
      { key: 'write', value: writeScores.length ? avg(writeScores) : Math.min(100, hz.length * 10) },
      { key: 'hanzi', value: avg(hz) },
      { key: 'culture', value: Math.min(100, chatTurns * 12) },
      { key: 'hskk', value: avg(mod('hskk')) },
    ].map((d) => ({ ...d, label: t(`profile.dims.${d.key}`) }));
  }, [hanziProgress, moduleProgress, chatTurns, t]);

  const overall = Math.round(dims.reduce((a, d) => a + d.value, 0) / dims.length);
  const hanziDone = Object.keys(hanziProgress).length;

  const issueCert = () => {
    const c = certRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = 800;
    const H = 560;
    c.width = W;
    c.height = H;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0a1430');
    g.addColorStop(1, '#101a3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 40px serif';
    ctx.fillText('国际中文能力数字证书', W / 2, 130);
    ctx.fillStyle = '#9bb0ff';
    ctx.font = '18px serif';
    ctx.fillText('Chinese Proficiency Digital Certificate', W / 2, 165);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px serif';
    ctx.fillText(name || '学员 Student', W / 2, 270);
    ctx.fillStyle = '#cceeff';
    ctx.font = '20px serif';
    ctx.fillText(`综合能力评分 Overall  ${overall}/100   ·   参考等级 HSK ${hskLevel}`, W / 2, 330);
    ctx.fillText(`已掌握汉字 ${hanziDone}  ·  对话练习 ${chatTurns} 次`, W / 2, 365);
    ctx.fillStyle = '#7c9cff';
    ctx.font = '16px serif';
    ctx.fillText('寰语星球 · Huanyu Planet', W / 2, 470);
    ctx.fillText(new Date().toLocaleDateString(), W / 2, 500);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `huanyu-cert-${name || 'student'}.png`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen">
      <Hud />
      <BackButton to="/globe" />
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-glow">🎓 {t('profile.title')}</h1>
            <p className="mt-2 text-white/60 text-sm">{t('profile.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => nav('/modules')} className="glass px-4 py-2 rounded-xl text-sm hover:border-starcyan/60">
              ✦ {t('hud.modules')}
            </button>
            <button onClick={() => nav('/teacher')} className="glass px-4 py-2 rounded-xl text-sm hover:border-starviolet/60">
              🧑‍🏫 {t('profile.teacherEntry')}
            </button>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {/* 能力雷达 */}
          <div className="glass rounded-3xl p-5">
            <h2 className="font-semibold text-glow mb-2">📡 {t('profile.radar')}</h2>
            <Radar dims={dims} />
            <div className="text-center text-sm text-white/70 mt-2">
              综合 / Overall <span className="text-gold font-bold">{overall}</span>/100
            </div>
          </div>

          {/* 学习足迹 + 证书 */}
          <div className="glass rounded-3xl p-5 flex flex-col">
            <h2 className="font-semibold text-glow mb-3">👣 {t('profile.footprint')}</h2>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-space-900/50 rounded-2xl py-4">
                <div className="text-2xl font-bold text-gold">{hanziDone}</div>
                <div className="text-xs text-white/55">{t('profile.hanziDone')}</div>
              </div>
              <div className="bg-space-900/50 rounded-2xl py-4">
                <div className="text-2xl font-bold text-starcyan">{chatTurns}</div>
                <div className="text-xs text-white/55">{t('profile.chatTurns')}</div>
              </div>
            </div>

            <h2 className="font-semibold text-glow mt-5 mb-2">🏅 {t('profile.cert')}</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的名字 / Your name"
              className="rounded-xl bg-space-900/70 border border-white/15 px-3 py-2 text-sm outline-none focus:border-starcyan/60"
            />
            <button onClick={issueCert} className="btn-primary px-4 py-2.5 rounded-xl text-sm mt-3 self-start">
              📜 {t('profile.issueCert')}
            </button>
            <canvas ref={certRef} className="hidden" />
          </div>
        </div>

        {/* 账户与积分（登录后显示：积分中心入口 + 改密码） */}
        {currentUser && (
          <div className="glass rounded-3xl p-5 mt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-glow">👤 {currentUser.name} <span className="text-xs text-white/45 font-normal">{currentUser.student_no ? `学号 ${currentUser.student_no}` : currentUser.role === 'teacher' ? '管理员' : ''}</span></h2>
                <p className="text-sm text-gold mt-1">{currentUser.credits}💎 积分 · 互动 {Math.floor((currentUser.total_active_sec || 0) / 60)} 分钟</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => nav('/rewards')} className="glass px-4 py-2 rounded-xl text-sm hover:border-gold/60">💎 积分中心</button>
                <button onClick={() => setShowPwd((v) => !v)} className="glass px-4 py-2 rounded-xl text-sm hover:border-starcyan/60">🔑 修改密码</button>
              </div>
            </div>
            {showPwd && (
              <div className="mt-4 grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center max-w-lg">
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  placeholder="旧密码"
                  className="rounded-lg bg-space-900/70 border border-white/15 px-3 py-2 text-sm outline-none focus:border-starcyan/60"
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="新密码（≥4位）"
                  className="rounded-lg bg-space-900/70 border border-white/15 px-3 py-2 text-sm outline-none focus:border-starcyan/60"
                />
                <button onClick={changePwd} className="btn-primary px-4 py-2 rounded-lg text-sm whitespace-nowrap">确认</button>
                {pwdMsg && <p className="text-xs text-white/70 sm:col-span-3">{pwdMsg}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
