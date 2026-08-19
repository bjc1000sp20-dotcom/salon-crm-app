-- LINE 官方帳號整合 Phase 4:預約前提醒

-- 1. 預約(全新、獨立於 visits,只用來排定未來時間 + 觸發提醒,不影響到店紀錄流程)
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  appointment_date date not null,
  appointment_time time,
  service_note text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_appointments_salon_date on appointments(salon_id, appointment_date);
create index if not exists idx_appointments_client on appointments(client_id);

alter table appointments enable row level security;
drop policy if exists appointments_all on appointments;
create policy appointments_all on appointments for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- 2. follow_up_templates 加上分類(術後追蹤 / 預約提醒 / 自訂),舊資料預設歸類到術後追蹤
alter table follow_up_templates add column if not exists kind text not null default 'aftercare_followup';
alter table follow_up_templates drop constraint if exists follow_up_templates_kind_check;
alter table follow_up_templates add constraint follow_up_templates_kind_check
  check (kind in ('appointment_reminder', 'aftercare_followup', 'custom'));

-- 3. follow_ups 加上分類 + 預約前提醒需要的重算欄位
alter table follow_ups add column if not exists kind text not null default 'aftercare_followup';
alter table follow_ups drop constraint if exists follow_ups_kind_check;
alter table follow_ups add constraint follow_ups_kind_check
  check (kind in ('appointment_reminder', 'aftercare_followup', 'reengagement', 'custom'));

alter table follow_ups add column if not exists appointment_id uuid references appointments(id) on delete cascade;
alter table follow_ups add column if not exists offset_days int;
alter table follow_ups add column if not exists message_template text;
create index if not exists idx_follow_ups_appointment on follow_ups(appointment_id);
