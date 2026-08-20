-- 客戶封存(軟刪除):封存後不出現在一般客戶列表,但所有紀錄都保留,之後可以恢復
alter table clients add column if not exists archived boolean not null default false;
alter table clients add column if not exists archived_at timestamptz;
