-- 工作室資訊圖片從「單張」升級成「多張清單」,結構比照 quick_phrases,多加縮圖排序/預設勾選/啟用停用
create table if not exists studio_info_images (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null default '',
  storage_path text not null,
  enabled boolean not null default true,
  default_selected boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_studio_info_images_salon on studio_info_images(salon_id);

alter table studio_info_images enable row level security;
drop policy if exists studio_info_images_all on studio_info_images;
create policy studio_info_images_all on studio_info_images for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- 保留使用者已經上傳過的舊單張圖片,搬進新的清單表,不會不見
insert into studio_info_images (salon_id, name, storage_path, sort_order, default_selected)
select id, '工作室資訊', studio_info_image_path, 1, true
from salons
where studio_info_image_path is not null;
