-- ============================================================
-- 懶人包:一次貼上、按一次 Run,套用 2026-08 新增的所有功能
-- (儲值可編輯、同意書、消費確認簽名、服務/來源佔比、商品銷售、
--  客戶問卷欄位、新的 client-signatures 檔案空間)
--
-- 這個檔案等同於把 migrations/0004~0010 七個檔案 + 新 bucket 建立
-- 全部合併在一起。已經寫成「重複執行也不會報錯」,所以就算你之前
-- 已經手動跑過其中幾個檔案也沒關係,直接整份貼上執行就好。
--
-- 想知道每一段在做什麼、想看異動歷史,可以去看 migrations/ 資料夾裡
-- 個別編號的檔案,內容完全一樣,只是拆成一個一個小檔案。
-- ============================================================

-- ---------- 0004:儲值紀錄可編輯 ----------
alter table topups add column if not exists updated_at timestamptz;
alter table topups add column if not exists updated_by uuid references auth.users(id);

-- ---------- 0005:同意書 + 消費確認簽名 ----------
alter table clients add column if not exists consent_signature_url text;
alter table clients add column if not exists consent_text_snapshot text;
alter table clients add column if not exists consent_signed_at timestamptz;

alter table salons add column if not exists consent_template text not null default
  '本次療程使用之產品與器材皆經過安全檢驗,療程過程如有不適請立即告知服務人員。本同意書僅作為店內服務紀錄,不具正式法律電子簽名效力。';

alter table visits add column if not exists confirmation_signature_url text;

-- ---------- 0006:服務項目佔比 ----------
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

-- ---------- 0007:客戶來源 ----------
alter table clients add column if not exists source text;

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

-- ---------- 0008:商品銷售 ----------
create table if not exists product_sales (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  item_name text not null,
  amount numeric(10,2) not null default 0,
  cost numeric(10,2) not null default 0,
  sale_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  created_by uuid references auth.users(id)
);
create index if not exists idx_product_sales_salon_date on product_sales(salon_id, sale_date);
create index if not exists idx_product_sales_client on product_sales(client_id);

alter table product_sales enable row level security;
drop policy if exists product_sales_all on product_sales;
create policy product_sales_all on product_sales for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- ---------- 0009:月結算加入商品銷售 ----------
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

-- ---------- 0010:客戶問卷欄位(紙本同意書數位化) ----------
alter table clients add column if not exists line_id text;
alter table clients add column if not exists address text;
alter table clients add column if not exists source_detail text;
alter table clients add column if not exists history_treatment boolean;
alter table clients add column if not exists history_supplement boolean;
alter table clients add column if not exists history_supplement_brand text;
alter table clients add column if not exists history_allergy boolean;
alter table clients add column if not exists makeup_habit boolean;
alter table clients add column if not exists uses_skincare boolean;
alter table clients add column if not exists skincare_brand text;
alter table clients add column if not exists skincare_types text[];
alter table clients add column if not exists daily_water_intake text;
alter table clients add column if not exists skin_concerns text[];
alter table clients add column if not exists skin_type text;
alter table clients add column if not exists photo_consent boolean;

-- ---------- 新的檔案空間:client-signatures ----------
-- 用 SQL 直接建立 bucket,不用進 Storage 頁面手動點「New bucket」。
-- 如果你的 Supabase 專案這行報權限錯誤,改成手動在後台 Storage 頁面
-- 建立一個叫 client-signatures 的 private bucket 即可,其他都不受影響。
insert into storage.buckets (id, name, public)
values ('client-signatures', 'client-signatures', false)
on conflict (id) do nothing;

drop policy if exists "client_signatures_isolation" on storage.objects;
create policy "client_signatures_isolation" on storage.objects
  for all
  using (
    bucket_id = 'client-signatures'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'client-signatures'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  );

-- 執行完畢!Success 訊息代表全部套用完成。
