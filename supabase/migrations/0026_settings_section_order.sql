-- 設定頁區塊順序,每家店存一份 key 陣列,沒存過就是 null(代表用預設順序)
alter table salons add column if not exists settings_section_order jsonb;
