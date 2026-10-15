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
