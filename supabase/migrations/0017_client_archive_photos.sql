-- 舊客戶紙本歷史資料照片(跟到店紀錄的膚況照片分開,不綁在任何一次 visit 底下,單純掛在客戶卡上)
--
-- 先在 Supabase 後台 -> Storage 手動建立一個新的 bucket(設為 Private,不要勾 Public):
--   client-archive
-- 建好之後,再回到這裡執行以下全部 SQL。

create table if not exists client_archive_photos (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  storage_path text not null,
  label text default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_client_archive_photos_client on client_archive_photos(client_id);

alter table client_archive_photos enable row level security;
drop policy if exists client_archive_photos_all on client_archive_photos;
create policy client_archive_photos_all on client_archive_photos for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- 檔案路徑規則跟其他 bucket 一樣:{salon_id}/{client_id}/...
create policy "client_archive_isolation" on storage.objects
  for all
  using (
    bucket_id = 'client-archive'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'client-archive'
    and (storage.foldername(name))[1] in (
      select id::text from salons where owner_user_id = auth.uid()
    )
  );
