-- 同意書:只在客戶第一次到店時簽一次,存在客戶卡上(跟現有 signature_url 同樣的模式)
alter table clients add column consent_signature_url text;
alter table clients add column consent_text_snapshot text;
alter table clients add column consent_signed_at timestamptz;

-- 每家店可自行編輯的同意書範本文字
alter table salons add column consent_template text not null default
  '本次療程使用之產品與器材皆經過安全檢驗,療程過程如有不適請立即告知服務人員。本同意書僅作為店內服務紀錄,不具正式法律電子簽名效力。';

-- 消費確認簽名:每一筆到店紀錄都有一個
alter table visits add column confirmation_signature_url text;
