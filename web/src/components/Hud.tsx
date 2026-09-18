import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangSwitch from './LangSwitch';
import TeacherSwitch from './TeacherSwitch';
import { useStore } from '../store/useStore';

// 顶部 HUD：Logo + Studio + 语言/老师下拉 + 登录态（积分💎 / 管理后台 / 登录登出）
export default function Hud() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const user = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);

  return (
    <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-5 py-3">
      <button onClick={() => nav('/globe')} className="flex items-center gap-2 group">
        <span className="text-xl">🌐</span>
        <span className="font-semibold tracking-wide text-glow group-hover:text-starcyan transition">
          {t('app.name')}
        </span>
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav('/studio')}
          className="px-3 py-1.5 rounded-lg glass text-xs hover:border-gold/60 transition"
          title={t('hud.studio')}
        >
          🎬
        </button>
        <LangSwitch />
        <TeacherSwitch />

        {user ? (
          <>
            {/* 积分 → 积分中心（排行榜/兑换） */}
            <button
              onClick={() => nav('/rewards')}
              className="px-2.5 py-1.5 rounded-lg glass text-xs text-gold whitespace-nowrap hover:border-gold/60"
              title={zh ? '积分中心：排行榜 / 兑换' : 'Points center'}
            >
              {user.credits}💎
            </button>
            {/* 管理员：进后台 */}
            {user.role === 'teacher' && (
              <button
                onClick={() => nav('/admin')}
                className="px-2.5 py-1.5 rounded-lg glass text-xs hover:border-starcyan/60"
                title={zh ? '管理后台' : 'Admin'}
              >
                🛠
              </button>
            )}
            <button
              onClick={() => nav('/profile')}
              className="w-8 h-8 rounded-full btn-primary grid place-items-center text-sm"
              title={user.name}
            >
              {(user.name || '👤').slice(0, 1)}
            </button>
            <button
              onClick={logout}
              className="px-2.5 py-1.5 rounded-lg glass text-xs hover:border-red-400/60"
              title={zh ? '退出登录' : 'Log out'}
            >
              ⎋
            </button>
          </>
        ) : (
          <button onClick={() => nav('/login')} className="px-3 py-1.5 rounded-lg btn-primary text-xs font-semibold">
            {zh ? '登录' : 'Sign in'}
          </button>
        )}
      </div>
    </header>
  );
}
