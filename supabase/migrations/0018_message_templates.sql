-- LINE 固定話術模板庫(獨立於現有的 follow_up_templates 自動排程系統,
-- 這是給店員手動組訊息時「快速套用」用的可重複使用短語,不影響原本 3/7/30 天自動追蹤的運作方式)

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  category text not null default '一般關心',
  message text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id)
);
create index if not exists idx_message_templates_salon on message_templates(salon_id);

alter table message_templates enable row level security;
drop policy if exists message_templates_all on message_templates;
create policy message_templates_all on message_templates for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
