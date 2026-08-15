-- LINE 官方帳號整合 Phase 3:客戶綁定 + 術後追蹤排程

-- 1. 客戶卡加上 LINE 綁定欄位
alter table clients add column if not exists line_user_id text;
alter table clients add column if not exists line_linked_at timestamptz;
create unique index if not exists idx_clients_line_user_id on clients(line_user_id) where line_user_id is not null;

-- 2. LINE 聯絡人「收件匣」——webhook 收到任何人傳訊息,先存在這裡等店家配對
create table if not exists line_contacts (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  last_message_text text,
  last_event_at timestamptz not null default now(),
  matched_client_id uuid references clients(id) on delete set null,
  matched_salon_id uuid references salons(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_line_contacts_matched on line_contacts(matched_client_id);

alter table line_contacts enable row level security;

-- 任何登入的店主都能看到「還沒被配對」的聯絡人(用來認人配對),
-- 以及已經配對到自己客戶的聯絡人(不會看到配對給別家店客戶的)
drop policy if exists line_contacts_select on line_contacts;
create policy line_contacts_select on line_contacts for select
  using (
    matched_client_id is null
    or matched_client_id in (select id from clients where salon_id in (select id from salons where owner_user_id = auth.uid()))
  );

drop policy if exists line_contacts_update on line_contacts;
create policy line_contacts_update on line_contacts for update
  using (matched_client_id is null)
  with check (
    matched_client_id in (select id from clients where salon_id in (select id from salons where owner_user_id = auth.uid()))
  );

-- 3. 追蹤訊息模板(可在設定頁編輯,不寫死在程式碼)
create table if not exists follow_up_templates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  days_after int not null,
  label text not null,
  message text not null,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_follow_up_templates_salon on follow_up_templates(salon_id);

alter table follow_up_templates enable row level security;
drop policy if exists follow_up_templates_all on follow_up_templates;
create policy follow_up_templates_all on follow_up_templates for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- 4. 實際排程(每一筆勾選建立的追蹤都是獨立一筆)
create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  template_id uuid references follow_up_templates(id) on delete set null,
  label text not null,
  message text not null,
  scheduled_at date not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_follow_ups_salon_scheduled on follow_ups(salon_id, scheduled_at);
create index if not exists idx_follow_ups_client on follow_ups(client_id);

alter table follow_ups enable row level security;
drop policy if exists follow_ups_all on follow_ups;
create policy follow_ups_all on follow_ups for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
