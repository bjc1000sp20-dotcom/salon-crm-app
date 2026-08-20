-- 工作室資訊圖片:每家店一張,存法比照既有的 clients.signature_url(固定檔名+upsert,不用另外開資料表)
alter table salons add column if not exists studio_info_image_path text;

-- 常用話語:名稱+內容+啟用+排序,結構比照既有的 services 表
create table if not exists quick_phrases (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  content text not null,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_quick_phrases_salon on quick_phrases(salon_id);

alter table quick_phrases enable row level security;
drop policy if exists quick_phrases_all on quick_phrases;
create policy quick_phrases_all on quick_phrases for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
