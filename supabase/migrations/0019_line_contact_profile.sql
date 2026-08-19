-- LINE 聯絡人加上 LINE 顯示名稱/大頭貼,讓「選擇 LINE 聯絡人」畫面看得到人而不只是一句訊息文字

alter table line_contacts add column if not exists display_name text;
alter table line_contacts add column if not exists picture_url text;
alter table line_contacts add column if not exists status_message text;
