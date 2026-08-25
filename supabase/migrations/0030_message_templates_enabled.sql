-- LINE 話術管理加上啟用/停用開關,停用後客戶資料卡的話術下拉選單不再顯示

alter table message_templates add column if not exists enabled boolean not null default true;
