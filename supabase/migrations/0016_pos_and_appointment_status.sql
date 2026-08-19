-- 預約狀態擴充(已確認/已到店/未到)+ 訂金管理 + 到店紀錄付款方式擴充(轉帳/信用卡/行動支付/其他)

alter table appointments drop constraint if exists appointments_status_check;
alter table appointments add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'));

alter table appointments add column if not exists deposit_amount numeric;
alter table appointments add column if not exists deposit_paid boolean not null default false;
alter table appointments add column if not exists deposit_payment_method text;
alter table appointments add column if not exists deposit_paid_at timestamptz;

alter table visits drop constraint if exists visits_payment_method_check;
alter table visits add constraint visits_payment_method_check
  check (payment_method in ('cash', 'balance', 'transfer', 'credit_card', 'mobile_payment', 'other'));
