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
