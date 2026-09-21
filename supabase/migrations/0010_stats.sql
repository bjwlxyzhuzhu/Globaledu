-- 0010 P4 成效面板 · 站点访问量统计（真实计数，服务端写入）
-- 首页每次访问 +1（按天累计）；成效面板与首页动态墙读取。
-- 纯新增、可重复执行。应用方式：Supabase 控制台 SQL Editor 粘贴执行。

create table if not exists public.site_visits (
  day date primary key,
  count bigint not null default 0
);

alter table public.site_visits enable row level security;
-- 不建任何客户端策略：读写全部经服务端 API（service_role），防刷防伪造。
