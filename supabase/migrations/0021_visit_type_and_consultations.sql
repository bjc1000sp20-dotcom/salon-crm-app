-- 「建立客戶」≠「來客」:到店紀錄加上類型(消費／單純諮詢／其他),
-- 營收/來客數統計只看「消費」類型的紀錄,舊資料全部預設消費,不影響既有數字。

alter table visits add column if not exists visit_type text not null default 'consumption';
alter table visits drop constraint if exists visits_visit_type_check;
alter table visits add constraint visits_visit_type_check
  check (visit_type in ('consumption', 'consultation', 'other'));

-- 營收只計入「消費」類型的到店紀錄(商品銷售本來就是消費行為,不用篩選)
create or replace function get_monthly_summary(p_salon_id uuid, p_month char(7))
returns table (
  revenue numeric, material_cost numeric, rent numeric,
  product_revenue numeric, product_cost numeric, product_profit numeric,
  total_revenue numeric, profit numeric
)
language sql
stable
security invoker
as $$
  with v as (
    select coalesce(sum(amount),0) as revenue, coalesce(sum(material_cost),0) as material_cost
    from visits
    where salon_id = p_salon_id and to_char(visit_date,'YYYY-MM') = p_month and visit_type = 'consumption'
  ), p as (
    select coalesce(sum(amount),0) as product_revenue, coalesce(sum(cost),0) as product_cost
    from product_sales where salon_id = p_salon_id and to_char(sale_date,'YYYY-MM') = p_month
  ), r as (
    select coalesce((select rent from monthly_rent where salon_id = p_salon_id and month = p_month), 0) as rent
  )
  select v.revenue, v.material_cost, r.rent,
    p.product_revenue, p.product_cost, (p.product_revenue - p.product_cost) as product_profit,
    (v.revenue + p.product_revenue) as total_revenue,
    (v.revenue + p.product_revenue - v.material_cost - p.product_cost - r.rent) as profit
  from v, p, r;
$$;

-- 來客人數/消費人次只算「消費」紀錄;新增「本月諮詢人數」(當月只有諮詢、沒有任何消費紀錄的客戶)
-- 與「諮詢成交率」用的「終身是否轉換成消費」欄位。回傳欄位有變動,要先 drop 再重建。
drop function if exists get_monthly_analytics(uuid, char);

create function get_monthly_analytics(p_salon_id uuid, p_month char(7))
returns table (
  total_clients int,
  visit_count int,
  male_count int,
  female_count int,
  unknown_gender_count int,
  new_count int,
  repeat_count int,
  consultation_count int,
  consultation_converted_count int
)
language sql
stable
security invoker
as $$
  with month_consumption as (
    select client_id from visits
    where salon_id = p_salon_id and to_char(visit_date, 'YYYY-MM') = p_month and visit_type = 'consumption'
  ),
  month_consumption_clients as (
    select distinct client_id from month_consumption
  ),
  with_gender as (
    select c.id, c.gender,
      (select count(*) from visits v2 where v2.client_id = c.id and v2.visit_type = 'consumption') as lifetime_visits
    from clients c
    where c.id in (select client_id from month_consumption_clients)
  ),
  month_consultation_only as (
    -- 當月有諮詢紀錄、但當月完全沒有消費紀錄的不重複客戶
    select distinct client_id from visits
    where salon_id = p_salon_id and to_char(visit_date, 'YYYY-MM') = p_month and visit_type = 'consultation'
      and client_id not in (select client_id from month_consumption_clients)
  ),
  consultation_converted as (
    -- 上面這群諮詢客戶裡,終身(不限本月)有任何一筆消費紀錄的人
    select mco.client_id from month_consultation_only mco
    where exists (select 1 from visits v3 where v3.client_id = mco.client_id and v3.visit_type = 'consumption')
  )
  select
    (select count(*) from with_gender)::int as total_clients,
    (select count(*) from month_consumption)::int as visit_count,
    (select count(*) filter (where gender = 'M') from with_gender)::int as male_count,
    (select count(*) filter (where gender = 'F') from with_gender)::int as female_count,
    (select count(*) filter (where gender = '' or gender is null) from with_gender)::int as unknown_gender_count,
    (select count(*) filter (where lifetime_visits < 3) from with_gender)::int as new_count,
    (select count(*) filter (where lifetime_visits >= 3) from with_gender)::int as repeat_count,
    (select count(*) from month_consultation_only)::int as consultation_count,
    (select count(*) from consultation_converted)::int as consultation_converted_count;
$$;
