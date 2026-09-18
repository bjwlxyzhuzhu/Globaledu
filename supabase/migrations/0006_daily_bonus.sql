-- M·每日登录奖励：记录上次发放日期，保证每个自然日（中国时区）只发一次 +30 积分。
-- 仅新增一列，幂等、无副作用；服务端用 service-role 读改 profiles，不依赖 RLS。
alter table public.profiles add column if not exists last_bonus_at date;

comment on column public.profiles.last_bonus_at is '上次发放每日登录积分的日期（Asia/Shanghai），用于每日签到 +30 去重';
