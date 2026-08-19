-- 生日提醒併入現有的 follow_ups / Cron 系統(kind = 'birthday'),不重建第二套排程機制

alter table clients add column if not exists birthday_reminder_enabled boolean not null default false;

alter table follow_ups add column if not exists birthday_year int;

-- 同一位客戶同一年最多只有一筆生日 follow_up,資料庫層直接擋重複發送,不用額外寫防重複邏輯
drop index if exists idx_follow_ups_birthday_unique;
create unique index idx_follow_ups_birthday_unique on follow_ups(client_id, birthday_year) where kind = 'birthday';

alter table follow_ups drop constraint if exists follow_ups_status_check;
alter table follow_ups add constraint follow_ups_status_check
  check (status in ('pending', 'sent', 'failed', 'cancelled', 'skipped'));

alter table follow_ups drop constraint if exists follow_ups_kind_check;
alter table follow_ups add constraint follow_ups_kind_check
  check (kind in ('appointment_reminder', 'aftercare_followup', 'reengagement', 'custom', 'birthday'));

-- 生日話術存在 salons 上,同一家店只需要一份,做法比照既有的 consent_template
alter table salons add column if not exists birthday_message_template text;
alter table salons add column if not exists birthday_offer_text text;
