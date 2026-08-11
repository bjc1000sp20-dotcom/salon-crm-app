-- 各服務項目佔比:同一筆到店紀錄如果選了多個服務項目,金額平均分攤到每個服務
-- (資料庫沒有存「每個服務各自的金額」,只有整筆到店的總金額,平均分攤是最合理的預設做法)
create or replace function get_service_mix(p_salon_id uuid, p_month char(7))
returns table (service_id text, visit_count int, revenue numeric)
language sql
stable
security invoker
as $$
  with month_visits as (
    select v.id, v.amount,
      (select count(*) from visit_services vs2 where vs2.visit_id = v.id) as svc_count
    from visits v
    where v.salon_id = p_salon_id and to_char(v.visit_date, 'YYYY-MM') = p_month
  )
  select vs.service_id, count(*)::int as visit_count,
    coalesce(sum(mv.amount / nullif(mv.svc_count, 0)), 0) as revenue
  from visit_services vs
  join month_visits mv on mv.id = vs.visit_id
  group by vs.service_id;
$$;
