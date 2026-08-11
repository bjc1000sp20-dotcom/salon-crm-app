-- 讓儲值紀錄可以編輯,並留下修改紀錄(誰、什麼時候改的)
alter table topups add column updated_at timestamptz;
alter table topups add column updated_by uuid references auth.users(id);
