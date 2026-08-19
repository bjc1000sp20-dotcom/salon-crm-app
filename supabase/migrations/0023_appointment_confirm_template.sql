-- 預約確認話術存在 salons 上,同一家店只需要一份,做法比照既有的 birthday_message_template
alter table salons add column if not exists appointment_confirm_template text;
