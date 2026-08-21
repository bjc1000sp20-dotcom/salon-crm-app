-- 產品搭配建議:單一客戶一份,直接貼另一個 App 複製出來的文字保存
alter table clients add column if not exists product_recommendation text;
alter table clients add column if not exists product_recommendation_updated_at timestamptz;

-- 客戶詳情頁區塊排序,存在 salons 上(全店共用一份,不是每個客戶各自一份),做法比照既有的 settings_section_order
alter table salons add column if not exists client_detail_section_order jsonb;
