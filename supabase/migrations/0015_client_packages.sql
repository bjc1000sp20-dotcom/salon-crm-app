-- 療程堂數管理:買了幾堂、用了幾堂、剩幾堂、到期提醒
-- 設計方式比照現有儲值帳本(topups + 扣款):client_packages 是「購買」,package_usage 是每次使用的「帳本」,
-- 剩餘堂數 = total_sessions - package_usage 的筆數,不另外存一個容易兜不起來的「已使用」欄位

create table if not exists client_packages (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  package_name text not null,
  total_sessions int not null,
  price numeric,
  purchase_date date not null,
  expire_date date,
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_client_packages_client on client_packages(client_id);
create index if not exists idx_client_packages_salon on client_packages(salon_id, status);

alter table client_packages enable row level security;
drop policy if exists client_packages_all on client_packages;
create policy client_packages_all on client_packages for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

create table if not exists package_usage (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  package_id uuid not null references client_packages(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  used_date date not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_package_usage_package on package_usage(package_id);

alter table package_usage enable row level security;
drop policy if exists package_usage_all on package_usage;
create policy package_usage_all on package_usage for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
