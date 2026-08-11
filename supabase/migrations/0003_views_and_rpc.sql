-- 儲值餘額:即時算,不存欄位(避免資料兜不起來),沿用原型 getClientBalance() 的邏輯
create view client_balances as
select
  c.id as client_id,
  c.salon_id,
  coalesce((select sum(t.amount) from topups t where t.client_id = c.id), 0)
  - coalesce((select sum(v.amount) from visits v where v.client_id = c.id and v.payment_method = 'balance'), 0)
  as balance
from clients c;

-- RLS 對 view 生效,view 底層查詢的表已經有 RLS,這裡不用再另外設定政策。
-- Postgres 的 view 預設會用 invoker 權限查底層表,搭配 security_invoker 更保險:
alter view client_balances set (security_invoker = true);

-- 當月營收/材料費/租金/淨利
create or replace function get_monthly_summary(p_salon_id uuid, p_month char(7))
returns table (revenue numeric, material_cost numeric, rent numeric, profit numeric)
language sql
stable
security invoker
as $$
  select
    coalesce((select sum(amount) from visits
      where salon_id = p_salon_id and to_char(visit_date, 'YYYY-MM') = p_month), 0) as revenue,
    coalesce((select sum(material_cost) from visits
      where salon_id = p_salon_id and to_char(visit_date, 'YYYY-MM') = p_month), 0) as material_cost,
    coalesce((select rent from monthly_rent
      where salon_id = p_salon_id and month = p_month), 0) as rent,
    coalesce((select sum(amount) from visits
      where salon_id = p_salon_id and to_char(visit_date, 'YYYY-MM') = p_month), 0)
    - coalesce((select sum(material_cost) from visits
      where salon_id = p_salon_id and to_char(visit_date, 'YYYY-MM') = p_month), 0)
    - coalesce((select rent from monthly_rent
      where salon_id = p_salon_id and month = p_month), 0) as profit;
$$;

-- 客戶分析:性別比例、新客/熟客比例(熟客 = 終身到店次數 >= 3)
-- 以「當月有到店的不重複客戶」為基準
create or replace function get_monthly_analytics(p_salon_id uuid, p_month char(7))
returns table (
  total_clients int,
  male_count int,
  female_count int,
  unknown_gender_count int,
  new_count int,
  repeat_count int
)
language sql
stable
security invoker
as $$
  with month_clients as (
    select distinct client_id
    from visits
    where salon_id = p_salon_id and to_char(visit_date, 'YYYY-MM') = p_month
  ),
  with_gender as (
    select c.id, c.gender,
      (select count(*) from visits v2 where v2.client_id = c.id) as lifetime_visits
    from clients c
    where c.id in (select client_id from month_clients)
  )
  select
    count(*)::int as total_clients,
    count(*) filter (where gender = 'M')::int as male_count,
    count(*) filter (where gender = 'F')::int as female_count,
    count(*) filter (where gender = '' or gender is null)::int as unknown_gender_count,
    count(*) filter (where lifetime_visits < 3)::int as new_count,
    count(*) filter (where lifetime_visits >= 3)::int as repeat_count
  from with_gender;
$$;

-- 本月壽星
create or replace function get_birthday_clients(p_salon_id uuid, p_month int)
returns table (id uuid, name text, birth_date date)
language sql
stable
security invoker
as $$
  select id, name, birth_date
  from clients
  where salon_id = p_salon_id
    and birth_date is not null
    and extract(month from birth_date) = p_month
  order by extract(day from birth_date);
$$;
