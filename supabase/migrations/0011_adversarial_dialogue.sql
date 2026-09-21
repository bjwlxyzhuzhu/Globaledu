-- Compatibility columns used by the research export
alter table public.profiles add column if not exists native_lang text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists hsk_level int;

-- =====================================================================
-- 0011 对抗性质询 · 轮级对话日志与研究数据层
--
-- 目的：为《对抗性多智能体课堂中的认知冲突与批判性思维生成机制》一文
--       采集可编码、可统计、可聚类的真实过程数据。
--
-- 现状问题：/api/ai/ask 一问一答即走，只在里程碑门槛处写 evidence_events
--          （问 300 字 / 答 800 字摘录）。这不足以支撑：
--            · 追问轮次强度与维度广度统计
--            · 质询—回应片段的三级编码与路径归纳
--            · 项目迭代序列的最优匹配聚类
--          以上三项恰是审稿专家1 第 1、3、4 条意见所要求的证据。
--
-- 纯新增、可重复执行。应用方式：Supabase 控制台 SQL Editor 粘贴执行。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 一、研究知情同意（写入 profiles，不新建表）
-- 未同意的学生照常使用平台，其数据不纳入研究分析。
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists research_consent boolean not null default false;
alter table public.profiles
  add column if not exists research_consent_at timestamptz;
alter table public.profiles
  add column if not exists research_pid text;   -- 研究编号（如 T01-S07），与姓名学号解耦

comment on column public.profiles.research_consent is
  '学生是否同意其平台过程数据被用于教学研究（匿名化后）。默认 false。';
comment on column public.profiles.research_pid is
  '研究用假名编号。导出分析数据时只带此列，不带 name/student_no。';


-- ---------------------------------------------------------------------
-- 二、对抗性质询会话
-- 一个团队针对一个方案版本接受一次完整的四维质询 = 一个 session
-- ---------------------------------------------------------------------
create table if not exists public.challenge_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  team_code text not null default '',       -- 团队编号（同一团队多名学生共享）
  round_no int not null default 1,          -- 该项目的第几轮质询（对应方案第几版）
  scenario text not null default '',        -- 课次，如 '创业机会识别'
  dbr_cycle int not null default 1,         -- 属于 DBR 第几轮迭代（1/2/3）
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists cs_user_idx    on public.challenge_sessions (user_id, started_at desc);
create index if not exists cs_project_idx on public.challenge_sessions (project_id, round_no);
create index if not exists cs_team_idx    on public.challenge_sessions (team_code, round_no);


-- ---------------------------------------------------------------------
-- 三、轮级对话日志 —— 本次改造的核心
-- 每一轮（智能体的一次追问 / 学生的一次回应）各一行。
-- ---------------------------------------------------------------------
create table if not exists public.dialogue_turns (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.challenge_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_index int not null,                  -- 会话内轮次序号，从 1 起

  speaker text not null,                    -- 'agent' | 'student' | 'teacher'
  agent_key text,                           -- virtual_user / investor / professor / peer
  conflict_dim text,                        -- demand / value / feasibility / ethics
  move_type text,                           -- 见下方 CHECK 说明；可先留空，由编码阶段回填

  content text not null,
  char_len int generated always as (char_length(content)) stored,

  -- 追问强度的机器可测代理指标（由 API 侧规则打标，编码阶段人工校验）
  demands_evidence boolean not null default false,  -- 该追问是否明确索要证据/数据
  cites_evidence   boolean not null default false,  -- 该回应是否给出了具体证据
  is_unanswered    boolean not null default false,  -- 学生是否回避/答不出

  created_at timestamptz not null default now()
);

create index if not exists dt_session_idx on public.dialogue_turns (session_id, turn_index);
create index if not exists dt_user_idx    on public.dialogue_turns (user_id, created_at desc);
create index if not exists dt_dim_idx     on public.dialogue_turns (conflict_dim, speaker);

comment on column public.dialogue_turns.move_type is
  '编码阶段回填。智能体侧：challenge_assumption/request_evidence/counter_example/reframe；'
  '学生侧：defend（维护原方案）/concede（承认问题）/verify（去查证）/revise（据证修正）/'
  'comply（无判断照单全收）/reject（视为刁难）。'
  '其中 verify+revise → 认识性调节；defend+reject 与 comply → 关系性调节。';


-- ---------------------------------------------------------------------
-- 四、方案版本快照 —— 迭代序列聚类的输入
-- 每次质询后学生修订方案即存一版，形成可做最优匹配的状态序列。
-- ---------------------------------------------------------------------
create table if not exists public.plan_versions (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_code text not null default '',
  version_no int not null,
  session_id uuid references public.challenge_sessions(id) on delete set null,

  sections jsonb not null default '{}'::jsonb,   -- 该版各分节全文
  change_summary text not null default '',       -- 学生自述这版改了什么、为什么

  -- 序列编码：本版相对上一版的状态（聚类时作为序列元素）
  -- A=提出新假设  F=假设被证伪  R=据证据修正  V=补充验证证据
  -- S=场景跃迁（校园→产业）  N=无实质变化
  seq_state char(1),

  created_at timestamptz not null default now(),
  unique (project_id, version_no)
);

create index if not exists pv_project_idx on public.plan_versions (project_id, version_no);
create index if not exists pv_team_idx    on public.plan_versions (team_code, version_no);


-- ---------------------------------------------------------------------
-- 五、批判性思维量规评分 —— 效度检验的输入
-- 同一份材料由多位评分者独立评分，用于 ICC 与因子分析。
-- ---------------------------------------------------------------------
create table if not exists public.ct_ratings (
  id bigint generated always as identity primary key,
  target_kind text not null,                -- 'plan_version' | 'session' | 'reflection'
  target_id text not null,                  -- 对应主键（转文本，兼容 bigint/uuid）
  ratee_user_id uuid references auth.users(id) on delete cascade,
  team_code text not null default '',
  rater_code text not null,                 -- 评分者编号 R1/R2/AI
  occasion text not null default 'pre',     -- pre / mid / post

  -- Facione 五维，各 0—2 分
  interpret smallint check (interpret between 0 and 2),
  evaluate  smallint check (evaluate  between 0 and 2),
  infer     smallint check (infer     between 0 and 2),
  selfreg   smallint check (selfreg   between 0 and 2),
  synthesis smallint check (synthesis between 0 and 2),
  total smallint generated always as
    (coalesce(interpret,0)+coalesce(evaluate,0)+coalesce(infer,0)
     +coalesce(selfreg,0)+coalesce(synthesis,0)) stored,

  note text not null default '',
  created_at timestamptz not null default now(),
  unique (target_kind, target_id, rater_code, occasion)
);

create index if not exists ctr_ratee_idx on public.ct_ratings (ratee_user_id, occasion);
create index if not exists ctr_team_idx  on public.ct_ratings (team_code, occasion);


-- ---------------------------------------------------------------------
-- 六、真实同伴反馈对照 —— 支撑"超过真实大班情境"这一论断
-- 没有这张表，"强度与广度超过真实反馈"就只是断言。
-- ---------------------------------------------------------------------
create table if not exists public.peer_feedback (
  id bigint generated always as identity primary key,
  project_id uuid references public.projects(id) on delete cascade,
  team_code text not null default '',
  round_no int not null default 1,
  from_user_id uuid references auth.users(id) on delete set null,
  conflict_dim text,                        -- demand / value / feasibility / ethics
  content text not null,
  demands_evidence boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pf_project_idx on public.peer_feedback (project_id, round_no);


-- ---------------------------------------------------------------------
-- 七、行级权限
-- 与 usage_logs / evidence_events 一致：客户端只读自己的，写入一律走服务端
-- service_role，学生无法伪造或篡改研究数据。
-- ---------------------------------------------------------------------
alter table public.challenge_sessions enable row level security;
alter table public.dialogue_turns     enable row level security;
alter table public.plan_versions      enable row level security;
alter table public.ct_ratings         enable row level security;
alter table public.peer_feedback      enable row level security;

drop policy if exists "cs_read" on public.challenge_sessions;
create policy "cs_read" on public.challenge_sessions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "dt_read" on public.dialogue_turns;
create policy "dt_read" on public.dialogue_turns
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "pv_read" on public.plan_versions;
create policy "pv_read" on public.plan_versions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "ctr_read" on public.ct_ratings;
create policy "ctr_read" on public.ct_ratings
  for select using (ratee_user_id = auth.uid() or public.is_admin());

drop policy if exists "pf_read" on public.peer_feedback;
create policy "pf_read" on public.peer_feedback
  for select using (from_user_id = auth.uid() or public.is_admin());
-- 均不建 INSERT/UPDATE/DELETE 策略：写入仅服务端 service_role。


-- ---------------------------------------------------------------------
-- 八、研究导出视图（已脱敏：只带 research_pid，不带姓名学号）
-- 分析时直接 select * 导出 CSV 即可。
-- ---------------------------------------------------------------------
create or replace view public.v_research_turns as
select
  t.id, t.session_id, t.turn_index, t.speaker, t.agent_key, t.conflict_dim,
  t.move_type, t.char_len, t.demands_evidence, t.cites_evidence, t.is_unanswered,
  t.content, t.created_at,
  s.team_code, s.round_no, s.scenario, s.dbr_cycle,
  p.research_pid
from public.dialogue_turns t
join public.challenge_sessions s on s.id = t.session_id
join public.profiles p          on p.id = t.user_id
where p.research_consent = true;

create or replace view public.v_research_sequences as
select
  v.project_id, v.team_code, v.version_no, v.seq_state, v.change_summary,
  v.created_at, p.research_pid
from public.plan_versions v
join public.profiles p on p.id = v.user_id
where p.research_consent = true
order by v.team_code, v.version_no;
