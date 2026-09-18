-- ===================================================================
-- 双创AI星际 · M5 安全加固（可选，建议跑）
-- 收紧 profiles 的 UPDATE 策略：仅管理员/教师可改（原策略 id=auth.uid() OR is_admin()
-- 且无 WITH CHECK → 学生可改自己的 credits 自助加分）。
-- 客户端无合法的 profiles 自写：改密走 auth、头像走 localStorage、扣分走 service_role。
-- 用法：Supabase Dashboard → SQL Editor → 粘贴本文件 → Run。依赖 0001（is_admin()）。
-- ===================================================================
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "admin profile update" on public.profiles;
create policy "admin profile update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
