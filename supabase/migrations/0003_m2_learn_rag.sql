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
