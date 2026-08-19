-- 服務項目從寫死在程式碼改成資料庫存放,可以自己新增/改名/排序/停用。
-- 種子資料用跟現有 visit_services.service_id 完全相同的字串當 id,舊到店紀錄不用搬資料就對得上。

create table if not exists services (
  id text primary key default gen_random_uuid()::text,
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  color text not null default '#B8886B',
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_services_salon on services(salon_id);

alter table services enable row level security;
drop policy if exists services_all on services;
create policy services_all on services for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
