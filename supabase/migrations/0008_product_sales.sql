create table product_sales (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  client_id uuid references clients(id) on delete set null, -- 可留空,允許沒有對應客戶的銷售
  item_name text not null,
  amount numeric(10,2) not null default 0,
  cost numeric(10,2) not null default 0,
  sale_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  created_by uuid references auth.users(id)
);
create index idx_product_sales_salon_date on product_sales(salon_id, sale_date);
create index idx_product_sales_client on product_sales(client_id);

alter table product_sales enable row level security;
create policy product_sales_all on product_sales for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));
