-- 0008 成长星图 · 证据事件层（P0）
-- 学生在各模块的里程碑产出自动"盖章存证"：选题结论 / BP 成稿 / 专家审稿 / 答辩雷达(五维时序) / 导出 / 技能启用。
-- 防伪造设计：与 usage_logs 相同——不开放客户端 INSERT，只由服务端 service_role 写入，时间戳由数据库生成。
-- 纯新增、可重复执行。应用方式：Supabase 控制台 SQL Editor 粘贴执行。

create table if not exists public.evidence_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null,               -- topic_match / bp_draft / expert_review / defense_radar / export_doc / skill_use / crew_final / intervention_response
  title text not null default '',   -- 星图上这颗"星"的名字（如「模拟答辩 · 高教主赛道·创意组」）
  dims jsonb,                       -- 五维能力快照（defense_radar 用）：{ key, axes:[{dim,score,max}], total }
  payload jsonb not null default '{}'::jsonb,  -- 产物引用/回放摘录（问题与回答节选、导出文件名等）
  created_at timestamptz not null default now()
);

create index if not exists evidence_user_time_idx on public.evidence_events (user_id, created_at desc);
create index if not exists evidence_user_kind_idx on public.evidence_events (user_id, kind, created_at desc);

alter table public.evidence_events enable row level security;

-- 学生可读自己的证据链；教师/管理员可读全部（学情看板、成长报告用）
drop policy if exists "evidence_own_read" on public.evidence_events;
create policy "evidence_own_read" on public.evidence_events
  for select using (user_id = auth.uid() or public.is_admin());

-- 不建 INSERT/UPDATE/DELETE 策略：写入仅服务端 service_role（绕过 RLS），学生无法伪造或篡改证据。
