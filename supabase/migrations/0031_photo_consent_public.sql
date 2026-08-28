-- 把「拍照授權」拆成兩個獨立同意事項:
-- photo_consent      = 服務紀錄拍照(既有欄位,沿用不動,舊資料保留)
-- photo_consent_public = 照片公開／案例使用(新欄位,舊客戶預設 null = 尚未填寫,不自動視為同意)

alter table clients add column if not exists photo_consent_public boolean;
