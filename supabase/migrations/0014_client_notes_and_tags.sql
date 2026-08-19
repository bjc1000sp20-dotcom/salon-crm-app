-- 客戶備註(可無限新增,每筆獨立、可編輯/刪除)+ 客戶標籤(店家自訂,同一套機制同時滿足風險標籤跟一般自訂標籤)

create table if not exists client_notes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz
);
create index if not exists idx_client_notes_client on client_notes(client_id);

alter table client_notes enable row level security;
drop policy if exists client_notes_all on client_notes;
create policy client_notes_all on client_notes for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (salon_id, name)
);

alter table tags enable row level security;
drop policy if exists tags_all on tags;
create policy tags_all on tags for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

create table if not exists client_tags (
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, tag_id)
);
create index if not exists idx_client_tags_client on client_tags(client_id);
create index if not exists idx_client_tags_tag on client_tags(tag_id);

alter table client_tags enable row level security;
drop policy if exists client_tags_all on client_tags;
create policy client_tags_all on client_tags for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
