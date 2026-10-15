-- ===================================================================
-- 双创AI星际 · M1 数据层（可重复运行）
-- 用法：Supabase Dashboard → SQL Editor → New query → 粘贴本文件 → Run
-- ===================================================================
create extension if not exists pgcrypto;

-- 角色枚举
do $$ begin
  create type public.user_role as enum ('student','teacher','admin');
exception when duplicate_object then null; end $$;

-- 用户档案（id 关联 auth.users，带积分）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_no text,
  name text,
  class text,
  college text,
  major text,
  role public.user_role not null default 'student',
  credits int not null default 120,
  created_at timestamptz default now()
);

-- 班级名单白名单（注册校验用）
create table if not exists public.rosters (
  id bigint generated always as identity primary key,
  class text, student_no text, name text, college text, major text, gender text,
  unique (class, student_no)
);

-- AI / 生图调用记账
create table if not exists public.usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  cost int not null default 0,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

-- 应用配置（积分规则 / 外链等，可被管理端覆盖）
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- 管理员判断（SECURITY DEFINER 避免 profiles 自引用 RLS 递归）
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin','teacher'));
$$;

-- 注册时自动建立档案
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ★ 原子扣分 + 记账（服务端唯一扣分入口）
create or replace function public.deduct_credits(
  p_user uuid, p_action text, p_cost int, p_meta jsonb default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare remaining int;
begin
  update public.profiles set credits = credits - p_cost
   where id = p_user and credits >= p_cost
   returning credits into remaining;
  if remaining is null then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;
  insert into public.usage_logs (user_id, action, cost, meta)
  values (p_user, p_action, p_cost, p_meta);
  return remaining;
end $$;

-- ===== 行级权限 =====
alter table public.profiles    enable row level security;
alter table public.usage_logs  enable row level security;
alter table public.rosters     enable row level security;
alter table public.app_config  enable row level security;

drop policy if exists "own profile read"   on public.profiles;
create policy "own profile read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists "logs read" on public.usage_logs;
create policy "logs read" on public.usage_logs for select using (user_id = auth.uid() or public.is_admin());
-- usage_logs 的写入由服务端 service_role 完成（绕过 RLS），不开放学生 INSERT，防伪造刷分。

drop policy if exists "rosters read"  on public.rosters;
create policy "rosters read"  on public.rosters for select using (auth.role() = 'authenticated');
drop policy if exists "rosters admin" on public.rosters;
create policy "rosters admin" on public.rosters for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "config read"  on public.app_config;
create policy "config read"  on public.app_config for select using (auth.role() = 'authenticated');
drop policy if exists "config admin" on public.app_config;
create policy "config admin" on public.app_config for all using (public.is_admin()) with check (public.is_admin());

-- 积分规则默认值
insert into public.app_config (key, value) values
  ('credit_costs', '{"chat":1,"topic":2,"text":5,"ppt":5,"image":10,"defense":2,"data":3}')
on conflict (key) do nothing;
