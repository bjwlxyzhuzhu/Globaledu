-- 0005 跨设备项目存储：学生的创业项目（名称/BP草稿/分节/团队）存云端，换设备可续、教师后台可看。
-- 纯新增、可重复执行。应用方式：Supabase 控制台 SQL Editor 粘贴执行，或 supabase db push。

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '我的项目',
  draft text not null default '',
  sections jsonb not null default '{}'::jsonb,
  team jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

-- 本人对自己的项目有全部权限
drop policy if exists "projects_own_all" on public.projects;
create policy "projects_own_all" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 教师/管理员可只读全部项目（复用 0001 的 public.is_admin()），用于后台查看学生产出
drop policy if exists "projects_admin_read" on public.projects;
create policy "projects_admin_read" on public.projects
  for select using (public.is_admin());

-- updated_at 自动更新
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated on public.projects;
create trigger projects_touch_updated before update on public.projects
  for each row execute function public.touch_updated_at();
