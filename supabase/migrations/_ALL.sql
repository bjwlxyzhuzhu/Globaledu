-- 双创AI星际 · 全部建表迁移（0001→0010）
-- 用法：Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 全部幂等，可重复执行。



-- ==================== 0001_init.sql ====================

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


-- ==================== 0002_user_api_keys.sql ====================

-- ===================================================================
-- 双创AI星际 · 用户自带 API Key（按用途/智能体）
-- 用法：Supabase Dashboard → SQL Editor → 粘贴 → Run（可重复运行）
-- ===================================================================
create table if not exists public.user_api_keys (
  user_id uuid references auth.users(id) on delete cascade,
  purpose text not null,            -- chat 通用对话 | reason 思考 | text 文本 | image PPT配图
  provider text,                    -- deepseek | moonshot | qwen | minimax | zhipu | openai | apimart | custom
  base_url text,
  api_key text,
  model text,
  updated_at timestamptz default now(),
  primary key (user_id, purpose)
);

alter table public.user_api_keys enable row level security;

-- 仅本人可增删改查自己的 key（浏览器端用 publishable key 即可安全管理）
drop policy if exists "own api keys" on public.user_api_keys;
create policy "own api keys" on public.user_api_keys for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ==================== 0003_m2_learn_rag.sql ====================

-- ===================================================================
-- 双创AI星际 · M2 闯关中心数据层（可重复运行）
-- 知识库(向量) + 案例宝库 + 模板宝库 + 相似度检索 RPC
-- 用法：Supabase Dashboard → SQL Editor → New query → 粘贴本文件 → Run
-- 依赖：0001_init.sql（is_admin()）已先跑过。
-- ===================================================================

-- pgvector 扩展（Supabase 默认可用）
create extension if not exists vector;

-- RAG 文本块：仅服务端 service_role 检索，不开放学生读原文
create table if not exists public.knowledge (
  id bigint generated always as identity primary key,
  source text not null,            -- 来源标签：案例 / 备赛指南 / 答辩100问 ...
  title text,                      -- 出处标题（案例名 / 文档名）
  tags text[] default '{}',
  chunk text not null,             -- 文本块
  embedding vector(1536),          -- text-embedding-3-small = 1536 维
  created_at timestamptz default now()
);

-- 案例宝库
create table if not exists public.cases (
  id bigint generated always as identity primary key,
  code text unique,                -- case-01 ...
  title text not null,
  region text,                     -- 区域（某市…）
  industry text,                   -- 产业（某新材料…）
  points text[] default '{}',      -- 核心知识点
  situation text,                  -- 案例情境
  task text,                       -- 课堂任务
  questions jsonb default '[]',    -- 讨论问题[]
  analysis jsonb default '[]',     -- 分析表[{dim,point,tip}]
  image text,                      -- /library/cases/case-01.png
  doc text,                        -- 原始 DOCX 下载路径（如有）
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- 模板宝库
create table if not exists public.templates (
  id bigint generated always as identity primary key,
  name text not null,
  category text,                   -- 计划书 / PPT / 合同 / 指南 ...
  file text,                       -- /library/templates/xxx.docx
  ext text,                        -- docx / pptx
  size_kb int,
  intro text,
  tags text[] default '{}',
  sort int default 0,
  created_at timestamptz default now()
);

-- 相似度检索（服务端 admin 调用；service_role 绕过 knowledge 的 RLS）
create or replace function public.match_knowledge(
  query_embedding vector(1536), match_count int default 6)
returns table(id bigint, source text, title text, chunk text, similarity float)
language sql stable set search_path = public as $$
  select k.id, k.source, k.title, k.chunk, 1 - (k.embedding <=> query_embedding) as similarity
  from public.knowledge k
  where k.embedding is not null
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

-- ===== 行级权限 =====
alter table public.knowledge enable row level security;  -- 无 select 策略 → 学生读不到；服务端 service_role 绕过
alter table public.cases     enable row level security;
alter table public.templates enable row level security;

drop policy if exists "cases read"  on public.cases;
create policy "cases read"  on public.cases for select using (auth.role() = 'authenticated');
drop policy if exists "cases admin" on public.cases;
create policy "cases admin" on public.cases for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "templates read"  on public.templates;
create policy "templates read"  on public.templates for select using (auth.role() = 'authenticated');
drop policy if exists "templates admin" on public.templates;
create policy "templates admin" on public.templates for all using (public.is_admin()) with check (public.is_admin());


-- ==================== 0004_admin_hardening.sql ====================

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


-- ==================== 0005_projects.sql ====================

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


-- ==================== 0006_daily_bonus.sql ====================

-- M·每日登录奖励：记录上次发放日期，保证每个自然日（中国时区）只发一次 +30 积分。
-- 仅新增一列，幂等、无副作用；服务端用 service-role 读改 profiles，不依赖 RLS。
alter table public.profiles add column if not exists last_bonus_at date;

comment on column public.profiles.last_bonus_at is '上次发放每日登录积分的日期（Asia/Shanghai），用于每日签到 +30 去重';


-- ==================== 0007_skills.sql ====================

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


-- ==================== 0008_evidence.sql ====================

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


-- ==================== 0009_interventions.sql ====================

-- 0009 教师干预闭环（P2）· 猫头鹰督导干预卡片
-- 实时触发：系统检测学生证据链中的成长风险模式（弱项连击/成稿未答辩/维度暴跌），
-- 由 AI（猫头鹰人格，反谄媚、对事不对人）生成四段式卡片：一针见血→证据→怎么改→去哪练。
-- 学生三按钮回应（接受/已改进/不同意），"不同意"升级教师裁决；回应本身写回证据链。
-- 写入/更新仅服务端 service_role（API 内做归属与状态机校验），学生端不可伪造。
-- 纯新增、可重复执行。应用方式：Supabase 控制台 SQL Editor 粘贴执行。

create table if not exists public.intervention_cards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule text not null,                       -- 触发规则标识（同一规则 7 天内不重复发卡）
  sharp text not null default '',           -- ①一针见血（犀利，但只指向产出证据，不指向人格）
  evidence text not null default '',        -- ②证据（触发本卡的具体事件描述）
  advice text not null default '',          -- ③怎么改（具体可执行动作）
  link_href text not null default '',       -- ④去哪练（平台内深链）
  link_label text not null default '',
  status text not null default 'open',      -- open / accepted / improved / disputed / retracted
  student_note text not null default '',    -- 学生回应备注（"不同意"时的申诉理由）
  teacher_note text not null default '',    -- 教师裁决/备注
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists icards_user_time_idx on public.intervention_cards (user_id, created_at desc);
create index if not exists icards_status_idx on public.intervention_cards (status, created_at desc);

alter table public.intervention_cards enable row level security;

-- 学生可读自己的卡；教师/管理员可读全部（督导队列）
drop policy if exists "icards_own_read" on public.intervention_cards;
create policy "icards_own_read" on public.intervention_cards
  for select using (user_id = auth.uid() or public.is_admin());

-- 不建 INSERT/UPDATE/DELETE 策略：全部经服务端 API（service_role），保证状态机与归属校验。


-- ==================== 0010_stats.sql ====================

-- 0010 P4 成效面板 · 站点访问量统计（真实计数，服务端写入）
-- 首页每次访问 +1（按天累计）；成效面板与首页动态墙读取。
-- 纯新增、可重复执行。应用方式：Supabase 控制台 SQL Editor 粘贴执行。

create table if not exists public.site_visits (
  day date primary key,
  count bigint not null default 0
);

alter table public.site_visits enable row level security;
-- 不建任何客户端策略：读写全部经服务端 API（service_role），防刷防伪造。


-- ==================== 0011_adversarial_dialogue.sql ====================

-- Compatibility columns
alter table public.profiles add column if not exists native_lang text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists hsk_level int;

-- =====================================================================
-- 0011 瀵规姉鎬ц川璇?路 杞骇瀵硅瘽鏃ュ織涓庣爺绌舵暟鎹眰
--
-- 鐩殑锛氫负銆婂鎶楁€у鏅鸿兘浣撹鍫備腑鐨勮鐭ュ啿绐佷笌鎵瑰垽鎬ф€濈淮鐢熸垚鏈哄埗銆嬩竴鏂?--       閲囬泦鍙紪鐮併€佸彲缁熻銆佸彲鑱氱被鐨勭湡瀹炶繃绋嬫暟鎹€?--
-- 鐜扮姸闂锛?api/ai/ask 涓€闂竴绛斿嵆璧帮紝鍙湪閲岀▼纰戦棬妲涘鍐?evidence_events
--          锛堥棶 300 瀛?/ 绛?800 瀛楁憳褰曪級銆傝繖涓嶈冻浠ユ敮鎾戯細
--            路 杩介棶杞寮哄害涓庣淮搴﹀箍搴︾粺璁?--            路 璐ㄨ鈥斿洖搴旂墖娈电殑涓夌骇缂栫爜涓庤矾寰勫綊绾?--            路 椤圭洰杩唬搴忓垪鐨勬渶浼樺尮閰嶈仛绫?--          浠ヤ笂涓夐」鎭版槸瀹＄涓撳1 绗?1銆?銆? 鏉℃剰瑙佹墍瑕佹眰鐨勮瘉鎹€?--
-- 绾柊澧炪€佸彲閲嶅鎵ц銆傚簲鐢ㄦ柟寮忥細Supabase 鎺у埗鍙?SQL Editor 绮樿创鎵ц銆?-- =====================================================================

-- ---------------------------------------------------------------------
-- 涓€銆佺爺绌剁煡鎯呭悓鎰忥紙鍐欏叆 profiles锛屼笉鏂板缓琛級
-- 鏈悓鎰忕殑瀛︾敓鐓у父浣跨敤骞冲彴锛屽叾鏁版嵁涓嶇撼鍏ョ爺绌跺垎鏋愩€?-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists research_consent boolean not null default false;
alter table public.profiles
  add column if not exists research_consent_at timestamptz;
alter table public.profiles
  add column if not exists research_pid text;   -- 鐮旂┒缂栧彿锛堝 T01-S07锛夛紝涓庡鍚嶅鍙疯В鑰?
comment on column public.profiles.research_consent is
  '瀛︾敓鏄惁鍚屾剰鍏跺钩鍙拌繃绋嬫暟鎹鐢ㄤ簬鏁欏鐮旂┒锛堝尶鍚嶅寲鍚庯級銆傞粯璁?false銆?;
comment on column public.profiles.research_pid is
  '鐮旂┒鐢ㄥ亣鍚嶇紪鍙枫€傚鍑哄垎鏋愭暟鎹椂鍙甫姝ゅ垪锛屼笉甯?name/student_no銆?;


-- ---------------------------------------------------------------------
-- 浜屻€佸鎶楁€ц川璇細璇?-- 涓€涓洟闃熼拡瀵逛竴涓柟妗堢増鏈帴鍙椾竴娆″畬鏁寸殑鍥涚淮璐ㄨ = 涓€涓?session
-- ---------------------------------------------------------------------
create table if not exists public.challenge_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  team_code text not null default '',       -- 鍥㈤槦缂栧彿锛堝悓涓€鍥㈤槦澶氬悕瀛︾敓鍏变韩锛?  round_no int not null default 1,          -- 璇ラ」鐩殑绗嚑杞川璇紙瀵瑰簲鏂规绗嚑鐗堬級
  scenario text not null default '',        -- 璇炬锛屽 '鍒涗笟鏈轰細璇嗗埆'
  dbr_cycle int not null default 1,         -- 灞炰簬 DBR 绗嚑杞凯浠ｏ紙1/2/3锛?  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists cs_user_idx    on public.challenge_sessions (user_id, started_at desc);
create index if not exists cs_project_idx on public.challenge_sessions (project_id, round_no);
create index if not exists cs_team_idx    on public.challenge_sessions (team_code, round_no);


-- ---------------------------------------------------------------------
-- 涓夈€佽疆绾у璇濇棩蹇?鈥斺€?鏈鏀归€犵殑鏍稿績
-- 姣忎竴杞紙鏅鸿兘浣撶殑涓€娆¤拷闂?/ 瀛︾敓鐨勪竴娆″洖搴旓級鍚勪竴琛屻€?-- ---------------------------------------------------------------------
create table if not exists public.dialogue_turns (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.challenge_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_index int not null,                  -- 浼氳瘽鍐呰疆娆″簭鍙凤紝浠?1 璧?
  speaker text not null,                    -- 'agent' | 'student' | 'teacher'
  agent_key text,                           -- virtual_user / investor / professor / peer
  conflict_dim text,                        -- demand / value / feasibility / ethics
  move_type text,                           -- 瑙佷笅鏂?CHECK 璇存槑锛涘彲鍏堢暀绌猴紝鐢辩紪鐮侀樁娈靛洖濉?
  content text not null,
  char_len int generated always as (char_length(content)) stored,

  -- 杩介棶寮哄害鐨勬満鍣ㄥ彲娴嬩唬鐞嗘寚鏍囷紙鐢?API 渚ц鍒欐墦鏍囷紝缂栫爜闃舵浜哄伐鏍￠獙锛?  demands_evidence boolean not null default false,  -- 璇ヨ拷闂槸鍚︽槑纭储瑕佽瘉鎹?鏁版嵁
  cites_evidence   boolean not null default false,  -- 璇ュ洖搴旀槸鍚︾粰鍑轰簡鍏蜂綋璇佹嵁
  is_unanswered    boolean not null default false,  -- 瀛︾敓鏄惁鍥為伩/绛斾笉鍑?
  created_at timestamptz not null default now()
);

create index if not exists dt_session_idx on public.dialogue_turns (session_id, turn_index);
create index if not exists dt_user_idx    on public.dialogue_turns (user_id, created_at desc);
create index if not exists dt_dim_idx     on public.dialogue_turns (conflict_dim, speaker);

comment on column public.dialogue_turns.move_type is
  '缂栫爜闃舵鍥炲～銆傛櫤鑳戒綋渚э細challenge_assumption/request_evidence/counter_example/reframe锛?
  '瀛︾敓渚э細defend锛堢淮鎶ゅ師鏂规锛?concede锛堟壙璁ら棶棰橈級/verify锛堝幓鏌ヨ瘉锛?revise锛堟嵁璇佷慨姝ｏ級/'
  'comply锛堟棤鍒ゆ柇鐓у崟鍏ㄦ敹锛?reject锛堣涓哄垇闅撅級銆?
  '鍏朵腑 verify+revise 鈫?璁よ瘑鎬ц皟鑺傦紱defend+reject 涓?comply 鈫?鍏崇郴鎬ц皟鑺傘€?;


-- ---------------------------------------------------------------------
-- 鍥涖€佹柟妗堢増鏈揩鐓?鈥斺€?杩唬搴忓垪鑱氱被鐨勮緭鍏?-- 姣忔璐ㄨ鍚庡鐢熶慨璁㈡柟妗堝嵆瀛樹竴鐗堬紝褰㈡垚鍙仛鏈€浼樺尮閰嶇殑鐘舵€佸簭鍒椼€?-- ---------------------------------------------------------------------
create table if not exists public.plan_versions (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_code text not null default '',
  version_no int not null,
  session_id uuid references public.challenge_sessions(id) on delete set null,

  sections jsonb not null default '{}'::jsonb,   -- 璇ョ増鍚勫垎鑺傚叏鏂?  change_summary text not null default '',       -- 瀛︾敓鑷堪杩欑増鏀逛簡浠€涔堛€佷负浠€涔?
  -- 搴忓垪缂栫爜锛氭湰鐗堢浉瀵逛笂涓€鐗堢殑鐘舵€侊紙鑱氱被鏃朵綔涓哄簭鍒楀厓绱狅級
  -- A=鎻愬嚭鏂板亣璁? F=鍋囪琚瘉浼? R=鎹瘉鎹慨姝? V=琛ュ厖楠岃瘉璇佹嵁
  -- S=鍦烘櫙璺冭縼锛堟牎鍥啋浜т笟锛? N=鏃犲疄璐ㄥ彉鍖?  seq_state char(1),

  created_at timestamptz not null default now(),
  unique (project_id, version_no)
);

create index if not exists pv_project_idx on public.plan_versions (project_id, version_no);
create index if not exists pv_team_idx    on public.plan_versions (team_code, version_no);


-- ---------------------------------------------------------------------
-- 浜斻€佹壒鍒ゆ€ф€濈淮閲忚璇勫垎 鈥斺€?鏁堝害妫€楠岀殑杈撳叆
-- 鍚屼竴浠芥潗鏂欑敱澶氫綅璇勫垎鑰呯嫭绔嬭瘎鍒嗭紝鐢ㄤ簬 ICC 涓庡洜瀛愬垎鏋愩€?-- ---------------------------------------------------------------------
create table if not exists public.ct_ratings (
  id bigint generated always as identity primary key,
  target_kind text not null,                -- 'plan_version' | 'session' | 'reflection'
  target_id text not null,                  -- 瀵瑰簲涓婚敭锛堣浆鏂囨湰锛屽吋瀹?bigint/uuid锛?  ratee_user_id uuid references auth.users(id) on delete cascade,
  team_code text not null default '',
  rater_code text not null,                 -- 璇勫垎鑰呯紪鍙?R1/R2/AI
  occasion text not null default 'pre',     -- pre / mid / post

  -- Facione 浜旂淮锛屽悇 0鈥? 鍒?  interpret smallint check (interpret between 0 and 2),
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
-- 鍏€佺湡瀹炲悓浼村弽棣堝鐓?鈥斺€?鏀拺"瓒呰繃鐪熷疄澶х彮鎯呭"杩欎竴璁烘柇
-- 娌℃湁杩欏紶琛紝"寮哄害涓庡箍搴﹁秴杩囩湡瀹炲弽棣?灏卞彧鏄柇瑷€銆?-- ---------------------------------------------------------------------
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
-- 涓冦€佽绾ф潈闄?-- 涓?usage_logs / evidence_events 涓€鑷达細瀹㈡埛绔彧璇昏嚜宸辩殑锛屽啓鍏ヤ竴寰嬭蛋鏈嶅姟绔?-- service_role锛屽鐢熸棤娉曚吉閫犳垨绡℃敼鐮旂┒鏁版嵁銆?-- ---------------------------------------------------------------------
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
-- 鍧囦笉寤?INSERT/UPDATE/DELETE 绛栫暐锛氬啓鍏ヤ粎鏈嶅姟绔?service_role銆?

-- ---------------------------------------------------------------------
-- 鍏€佺爺绌跺鍑鸿鍥撅紙宸茶劚鏁忥細鍙甫 research_pid锛屼笉甯﹀鍚嶅鍙凤級
-- 鍒嗘瀽鏃剁洿鎺?select * 瀵煎嚭 CSV 鍗冲彲銆?-- ---------------------------------------------------------------------
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
