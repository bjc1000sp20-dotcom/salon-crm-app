-- 把店主原本紙本「顧客服務同意書」的欄位數位化,加到客戶卡上

-- 聯絡資訊
alter table clients add column line_id text;
alter table clients add column address text;

-- 客戶來源細節(搭配原本的 source 分類,填介紹人姓名或平台名稱)
alter table clients add column source_detail text;

-- 基本狀況問卷(第一次建卡時填,之後可編輯)
alter table clients add column history_treatment boolean; -- 是否曾用藥/擦酸類/整形手術/雷射/其他皮膚課程
alter table clients add column history_supplement boolean; -- 是否有額外補充營養食品
alter table clients add column history_supplement_brand text;
alter table clients add column history_allergy boolean; -- 是否曾經有肌膚過敏史
alter table clients add column makeup_habit boolean; -- 平時是否有化妝習慣
alter table clients add column uses_skincare boolean; -- 平時是否有使用保養品
alter table clients add column skincare_brand text;
alter table clients add column skincare_types text[]; -- 化妝水/精華液/乳液霜/防曬/其他
alter table clients add column daily_water_intake text; -- 日常一天喝水量(自由文字,例如「1500ml」)
alter table clients add column skin_concerns text[]; -- 最想解決的肌膚問題(可複選)

-- 以下由美容師填寫
alter table clients add column skin_type text; -- 'dry' | 'oily' | 'combination'

-- 授權拍照/影片紀錄及宣傳(在同意書簽名那一步一起確認)
alter table clients add column photo_consent boolean;
