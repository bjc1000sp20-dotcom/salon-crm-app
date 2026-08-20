-- 潛在客戶追蹤(IG/LINE 詢問但還不是正式客戶):目前進度選項清單,結構比照 quick_phrases
create table if not exists lead_statuses (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_statuses_salon on lead_statuses(salon_id);
alter table lead_statuses enable row level security;
drop policy if exists lead_statuses_all on lead_statuses;
create policy lead_statuses_all on lead_statuses for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- 潛在客戶本體:名稱/聯絡帳號都可以先不填,不強迫先建立正式客戶
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  created_by uuid references auth.users(id),
  name text,
  channel text not null default 'instagram' check (channel in ('instagram', 'line', 'facebook', 'threads', 'phone', 'other')),
  contact_handle text,
  status_id uuid references lead_statuses(id) on delete set null,
  notes text,
  state text not null default 'active' check (state in ('active', 'converted', 'not_tracking')),
  converted_client_id uuid references clients(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_leads_salon on leads(salon_id);
alter table leads enable row level security;
drop policy if exists leads_all on leads;
create policy leads_all on leads for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- 每一次追蹤提醒都是獨立一筆,「延後」改本筆日期,「再次追蹤」把本筆標完成再新增一筆,歷史完整保留
create table if not exists lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  salon_id uuid not null references salons(id) on delete cascade,
  content text not null,
  remind_date date not null,
  remind_time time,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  snoozed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_follow_ups_lead on lead_follow_ups(lead_id);
create index if not exists idx_lead_follow_ups_salon on lead_follow_ups(salon_id);
alter table lead_follow_ups enable row level security;
drop policy if exists lead_follow_ups_all on lead_follow_ups;
create policy lead_follow_ups_all on lead_follow_ups for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
