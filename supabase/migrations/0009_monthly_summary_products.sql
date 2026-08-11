-- get_monthly_summary 要多回傳幾個欄位(產品營收/成本/淨利、加總後的總營收),
-- Postgres 不允許直接 create or replace 改變 returns table 的欄位結構,所以先 drop 再重建。
drop function if exists get_monthly_summary(uuid, char);

create function get_monthly_summary(p_salon_id uuid, p_month char(7))
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
    from visits where salon_id = p_salon_id and to_char(visit_date,'YYYY-MM') = p_month
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
