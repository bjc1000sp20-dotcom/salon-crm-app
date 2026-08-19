-- 商品購買紀錄加上數量與預估可用天數,用來推算「快用完了要提醒回購」

alter table product_sales add column if not exists quantity int not null default 1;
alter table product_sales add column if not exists estimated_days_supply int;
