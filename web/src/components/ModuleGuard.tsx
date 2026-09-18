import { useEffect, useState, type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';

// 模块访问守卫：教师在管理后台关闭的模块，学生直接输网址也进不去，会被送回学习星球。
// 说明：这是课堂层面的引导，不是安全边界——各模块的数据接口本身仍是开放的。
export default function ModuleGuard({ id, children }: { id: string; children: ReactElement }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .myModules()
      .then((r) => alive && setAllowed(r.all || r.modules.includes(id)))
      .catch(() => alive && setAllowed(true)); // 接口异常时不拦截，避免误伤
    return () => {
      alive = false;
    };
  }, [id]);

  if (allowed === null) return null; // 校验中，先不渲染，避免闪烁
  return allowed ? children : <Navigate to="/modules" replace />;
}
