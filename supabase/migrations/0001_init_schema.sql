-- 美容客戶管理系統 — 基礎資料表
-- 貼到 Supabase 後台 -> SQL Editor 執行(或用 supabase CLI 跑 migration)

create extension if not exists pgcrypto; -- gen_random_uuid() 需要

-- 1. 帳號(1 位美容師 = 1 個 salons 列,先 1:1 對應 auth.users,
--    拆成獨立表是為了未來同一家店可以有多個員工登入而不用改資料結構)
create table salons (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  salon_name text not null default '',
  created_at timestamptz not null default now(),
  -- 以下是未來訂閱付費要用的欄位,這次先不寫邏輯,只保留位置
  plan_status text not null default 'trial',
  plan_expires_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text
);

-- 2. 客戶卡
create table clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  phone text default '',
  gender text not null default '' check (gender in ('F', 'M', '')),
  birth_date date,
  signature_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_clients_salon on clients(salon_id);

-- 3. 到店紀錄
create table visits (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  visit_date date not null,
  amount numeric(10, 2) not null default 0,
  material_cost numeric(10, 2) not null default 0,
  payment_method text not null check (payment_method in ('cash', 'balance')),
  skin_condition text default '',
  next_visit_note text default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_visits_salon_date on visits(salon_id, visit_date);
create index idx_visits_client on visits(client_id);

-- 4. 到店服務項目(多選,junction table)
create table visit_services (
  visit_id uuid not null references visits(id) on delete cascade,
  service_id text not null,
  primary key (visit_id, service_id)
);

-- 5. 儲值/扣款帳本
create table topups (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric(10, 2) not null,
  topup_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_topups_client on topups(client_id);
create index idx_topups_salon on topups(salon_id);

-- 6. 每月租金
create table monthly_rent (
  salon_id uuid not null references salons(id) on delete cascade,
  month char(7) not null, -- 'YYYY-MM'
  rent numeric(10, 2) not null default 0,
  primary key (salon_id, month)
);

-- 7. 到店照片
create table visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_visit_photos_visit on visit_photos(visit_id);
