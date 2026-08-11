-- 客戶來源(哪個管道來的),用固定幾個選項,方便統計佔比
alter table clients add column source text; -- 'ig' | 'threads' | 'friend_referral' | 'client_referral' | null(未填)

-- 當月「新建立」的客戶,依來源統計人數佔比(用客戶卡建立時間,不是到店時間)
create or replace function get_source_mix(p_salon_id uuid, p_month char(7))
returns table (source text, client_count int)
language sql
stable
security invoker
as $$
  select coalesce(source, 'unknown') as source, count(*)::int as client_count
  from clients
  where salon_id = p_salon_id and to_char(created_at, 'YYYY-MM') = p_month
  group by coalesce(source, 'unknown');
$$;
