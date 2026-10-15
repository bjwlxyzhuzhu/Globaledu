import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getToken } from '../lib/api';

// 登录守卫：后端 /api/* 已改为默认拒绝，这里把前端对齐，
// 让未登录用户看到登录页而不是一屏「HTTP 401」。
//
// 判断用 getToken() 而不是 store 里的 currentUser：App 启动时 api.me() 是异步的，
// 刷新页面的瞬间 currentUser 还是 null，用它判断会把已登录用户误踢到登录页。
// 令牌无效时 App 的 me().catch(logout) 会清掉它，这里随即重渲染并跳转。
export default function RequireAuth({
  children,
  teacherOnly = false,
}: {
  children: ReactElement;
  teacherOnly?: boolean;
}): ReactElement | null {
  const location = useLocation();
  const currentUser = useStore((s) => s.currentUser);

  if (!getToken()) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  if (teacherOnly) {
    if (!currentUser) return null; // 资料加载中，先不渲染，避免闪一下再跳走
    if (currentUser.role !== 'teacher') return <Navigate to="/modules" replace />;
  }

  return children;
}
