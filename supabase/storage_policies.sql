-- 先在 Supabase 後台 -> Storage 手動建立三個 bucket(都設為 Private,不要勾 Public):
--   signatures         -- 客戶卡建立時的簽名
--   visit-photos       -- 到店照片
--   client-signatures  -- 同意書簽名 + 每次到店的消費確認簽名(這批新功能新增的)
-- 建好之後,回到 SQL Editor 執行以下政策,限制只能存取自己 salon 路徑下的檔案。
-- 檔案路徑規則:{salon_id}/{client_id}/... ,所以用路徑的第一段字串比對 salon_id。

create policy "signatures_isolation" on storage.objects
  for all
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  );

create policy "visit_photos_isolation" on storage.objects
  for all
  using (
    bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  );

create policy "client_signatures_isolation" on storage.objects
  for all
  using (
    bucket_id = 'client-signatures'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'client-signatures'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  );
