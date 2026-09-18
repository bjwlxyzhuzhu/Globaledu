-- M·技能系统：用户沉淀的自有技能 + 用户启用/安装的技能 id。
-- 仅两张表，RLS「仅本人」，客户端用 supabase client 直接增删改（同 user_api_keys 模式，无需 service-role）。
-- 不动 profiles（规避 0004 加固对自写的限制）。幂等。

-- 1) 用户沉淀的自有技能
create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '🧩',
  category text default '我的',
  scope text default 'all',          -- all / leader / writer / 或某搭子 key（strategy/design/teacher/student/industry/mentor/advisor/boss）
  instruction text not null,         -- 注入到智能体 system 的技能指令
  created_at timestamptz default now()
);
alter table public.user_skills enable row level security;
drop policy if exists "own user_skills" on public.user_skills;
create policy "own user_skills" on public.user_skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) 用户已启用/安装的技能 id（内置/商店用其字符串 id；自有用 'mine:'+uuid；演示插件用 'plugin:'+id）
create table if not exists public.user_enabled_skills (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  created_at timestamptz default now(),
  primary key (user_id, skill_id)
);
alter table public.user_enabled_skills enable row level security;
drop policy if exists "own user_enabled_skills" on public.user_enabled_skills;
create policy "own user_enabled_skills" on public.user_enabled_skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
