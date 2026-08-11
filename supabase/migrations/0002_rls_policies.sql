-- Row Level Security —— 這是「能不能賣給別人用」的核心：
-- 每個帳號只能讀寫自己 salon 底下的資料,就算直接打 API/改網址也一樣被資料庫擋下。

alter table salons enable row level security;
alter table clients enable row level security;
alter table visits enable row level security;
alter table visit_services enable row level security;
alter table topups enable row level security;
alter table monthly_rent enable row level security;
alter table visit_photos enable row level security;

-- salons:只能看到/修改自己的那一列
create policy salons_select on salons for select using (owner_user_id = auth.uid());
create policy salons_insert on salons for insert with check (owner_user_id = auth.uid());
create policy salons_update on salons for update using (owner_user_id = auth.uid());
create policy salons_delete on salons for delete using (owner_user_id = auth.uid());

-- clients:透過 salon_id 判斷擁有者
create policy clients_all on clients for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- visits:同樣直接用 salon_id(denormalized,不用每次都 join clients)
create policy visits_all on visits for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- topups
create policy topups_all on topups for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- monthly_rent
create policy monthly_rent_all on monthly_rent for all
  using (salon_id in (select id from salons where owner_user_id = auth.uid()))
  with check (salon_id in (select id from salons where owner_user_id = auth.uid()));

-- visit_services:沒有直接的 salon_id,透過 visits 再 join salons 判斷
create policy visit_services_all on visit_services for all
  using (visit_id in (
    select v.id from visits v
    join salons s on s.id = v.salon_id
    where s.owner_user_id = auth.uid()
  ))
  with check (visit_id in (
    select v.id from visits v
    join salons s on s.id = v.salon_id
    where s.owner_user_id = auth.uid()
  ));

-- visit_photos:同樣透過 visits join salons
create policy visit_photos_all on visit_photos for all
  using (visit_id in (
    select v.id from visits v
    join salons s on s.id = v.salon_id
    where s.owner_user_id = auth.uid()
  ))
  with check (visit_id in (
    select v.id from visits v
    join salons s on s.id = v.salon_id
    where s.owner_user_id = auth.uid()
  ));
