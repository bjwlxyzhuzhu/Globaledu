import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import SpaceBackdrop from '../components/SpaceBackdrop';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';

// 登录页：学生（学号+密码）/ 管理员（账号+密码）双 Tab。登录成功发积分并跳转。
// 未登录也可继续体验，仅学习计分/积分需要登录。
export default function Login() {
  const { i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const nav = useNavigate();
  const login = useStore((s) => s.login);
  const [tab, setTab] = useState<'student' | 'admin'>('student');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  const submit = async () => {
    setErr('');
    if (!account.trim() || !password) {
      setErr(zh ? '请输入账号和密码' : 'Enter account and password');
      return;
    }
    setBusy(true);
    try {
      const r = await api.login({ account: account.trim(), password, as: tab });
      login(r.user, r.token);
      if (r.awarded > 0) {
        setToast(
          (zh ? `登录成功，获得 +${r.awarded} 积分` : `Logged in, +${r.awarded} points`) +
            (r.awardType === 'register' ? (zh ? '（首次登录奖励）' : ' (welcome bonus)') : zh ? '（每日登录）' : ' (daily)'),
        );
      }
      // 管理员进后台，学生进主世界
      setTimeout(() => nav(r.user.role === 'teacher' ? '/admin' : '/globe'), r.awarded > 0 ? 700 : 0);
    } catch (e) {
      setErr((e as Error).message || (zh ? '登录失败' : 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative grid place-items-center px-4 overflow-hidden">
      <SpaceBackdrop className="absolute inset-0 w-full h-full -z-10" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-7 w-full max-w-sm relative"
      >
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🪐</div>
          <h1 className="text-xl font-bold text-glow">{zh ? '寰语星球 · 登录' : 'Huanyu Planet · Sign in'}</h1>
          <p className="text-xs text-white/45 mt-1">
            {zh ? '登录后记录学情、累计积分与互动时长' : 'Sign in to track progress, points and active time'}
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex rounded-xl bg-space-800/80 border border-white/10 p-1 mb-5 text-sm">
          {(['student', 'admin'] as const).map((tk) => (
            <button
              key={tk}
              onClick={() => {
                setTab(tk);
                setErr('');
              }}
              className={
                'flex-1 py-2 rounded-lg transition ' +
                (tab === tk ? 'bg-starcyan/20 text-starcyan font-semibold' : 'text-white/60 hover:text-white')
              }
            >
              {tk === 'student' ? (zh ? '🎓 学生登录' : '🎓 Student') : zh ? '🛠 管理员' : '🛠 Admin'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/55">
              {tab === 'student' ? (zh ? '学号' : 'Student ID') : zh ? '管理员账号' : 'Admin account'}
            </label>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={tab === 'student' ? (zh ? '如 2026001' : 'e.g. 2026001') : 'admin'}
              className="w-full mt-1 bg-space-800 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/90 focus:border-starcyan/60 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/55">{zh ? '密码' : 'Password'}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={tab === 'student' ? (zh ? '初始密码为学号' : 'default = student ID') : '••••••'}
              className="w-full mt-1 bg-space-800 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/90 focus:border-starcyan/60 outline-none"
            />
          </div>

          {err && <p className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{err}</p>}
          {toast && <p className="text-xs text-gold bg-gold/10 rounded-lg px-3 py-2">✨ {toast}</p>}

          <button
            onClick={submit}
            disabled={busy}
            className="btn-primary w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {busy ? (zh ? '登录中…' : 'Signing in…') : zh ? '登录' : 'Sign in'}
          </button>
        </div>

        {tab === 'student' && (
          <div className="mt-4 space-y-1.5">
            <p className="text-[11px] text-white/40 leading-relaxed">
              {zh
                ? '学号与初始密码由老师导入班级时分配（初始密码＝学号）。还没有账号？直接 '
                : 'Your teacher assigns your ID and initial password (initial password = student ID). No account? '}
              <button onClick={() => nav('/globe')} className="text-starcyan hover:underline">
                {zh ? '以游客身份探索' : 'explore as guest'}
              </button>
            </p>
            <p className="text-[11px] text-white/35 leading-relaxed">
              🔑 {zh
                ? '忘记密码？请联系老师/管理员在后台重置（会重置为你的学号，登录后可自行修改）。'
                : 'Forgot password? Ask your teacher to reset it (resets to your student ID; change it after logging in).'}
            </p>
          </div>
        )}
        {tab === 'admin' && (
          <p className="text-[11px] text-white/40 mt-4 leading-relaxed">
            {zh
              ? '管理员账号由系统管理员分配，忘记密码请联系系统管理员重置。'
              : 'Admin accounts are issued by the system administrator. Contact them to reset a password.'}
          </p>
        )}
      </motion.div>
    </div>
  );
}
