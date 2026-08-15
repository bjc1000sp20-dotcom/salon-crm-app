# 美容客戶管理系統(salon-crm)

多帳號版的客戶管理 App。每位美容師註冊自己的帳號,資料互相看不到,換手機、換瀏覽器登入同帳號資料都在。取代原本桌面上那份單機版原型(`客戶管理系統.html`)。

## 技術架構

- 前端:Vite + 純 JavaScript(無框架),沿用原型的手刻頁面切換風格
- 後端:[Supabase](https://supabase.com)(Postgres 資料庫 + 帳號登入 + 檔案儲存),前端直接連 Supabase,不用另外寫後端 API
- 帳號隔離:Postgres **Row Level Security**,資料庫層強制執行,不是只有畫面上不顯示
- 部署:Vercel(純靜態網站,`npm run build` 產出 `dist/` 資料夾)

## LINE 官方帳號串接(進行中,分階段開發)

`api/` 資料夾是新增的 Vercel Serverless Functions(伺服器端程式碼),跟 `src/` 底下的靜態前端完全分開,不會互相干擾。目前狀態:

- `api/line/webhook.js` — 接收 LINE 傳來的事件(加好友、傳訊息、封鎖),驗證簽章,**目前只記錄 log,不會寫入任何 CRM 資料、不會自動回覆**
- `api/line/test-push.js` — 測試用端點,確認後端能不能成功呼叫 LINE 推播,需要帶正確的 `x-internal-secret` header 才能用
- `api/_lib/` — 共用邏輯(呼叫 LINE API、驗證簽章、讀取原始請求內容)

需要在 Vercel 後台新增的環境變數(**都不要加 `VITE_` 前綴**,這樣才不會被打包進前端):
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `INTERNAL_API_SECRET`(自己設一組隨機字串,用來保護測試/內部用的 API,不要用簡單的字)

之後 Phase 3(客戶綁定 LINE)開始會需要 Supabase 的 **Secret key**(在 Supabase 後台「API Keys → Publishable and secret API keys」那頁,`sb_secret_...` 開頭那把,不是 Publishable key),屆時會再新增 `SUPABASE_SERVICE_ROLE_KEY` 這個環境變數,一樣只給後端用。

## 第一次設定步驟

### 1. 建立 Supabase 專案

1. 開 https://supabase.com ,登入後「New Project」,取名、設密碼、選離台灣近的區域(例如新加坡)
2. 建立完成後,左側選單「SQL Editor」,依序貼上並執行下面三個檔案的完整內容(順序很重要):
   - [supabase/migrations/0001_init_schema.sql](supabase/migrations/0001_init_schema.sql) — 建資料表
   - [supabase/migrations/0002_rls_policies.sql](supabase/migrations/0002_rls_policies.sql) — 開帳號隔離規則(這步不能省略,沒做的話任何登入的人都看得到所有人的資料)
   - [supabase/migrations/0003_views_and_rpc.sql](supabase/migrations/0003_views_and_rpc.sql) — 儲值餘額、月加總、分析用的查詢函式

### 2. 開啟登入功能

左側選單「Authentication」→ CONFIGURATION 區塊裡的「**Sign In / Providers**」。頁面下方有一個「Auth Providers」清單,點開 **Email** 這一項,確認第一個「Enable email provider」是綠色開啟的(Supabase 預設就是開的,通常不用改)。

如果不想要求信箱驗證(小工作室內部使用,想直接註冊就能用):**「Confirm email」不在剛剛點開的 Email 面板裡**,要回到「Sign In / Providers」頁面上方,找另一個「**User Signups**」區塊,裡面才有「Confirm email」的開關,把它關掉;不關的話,新帳號註冊後要先收信驗證才能登入。

### 3. 建立檔案儲存空間(照片、簽名)

1. 左側選單「Storage」,建立兩個 Bucket,**都不要勾選 Public**:
   - `signatures`
   - `visit-photos`
2. 設定這兩個 Bucket 的安全規則,做法跟前面跑 migration 完全一樣:
   1. 用記事本(或任何文字編輯器)打開專案資料夾裡的 [supabase/storage_policies.sql](supabase/storage_policies.sql) 這個檔案,全選、複製裡面所有文字
   2. 回到 Supabase 後台左側選單「SQL Editor」,點「New query」開一個新的查詢
   3. 把剛剛複製的內容貼進去,按右下角「Run」執行
   4. 這段 SQL 在做的事,白話講就是:讓每個帳號以後只看得到自己上傳的照片、簽名檔案,不會看到別人上傳的——**不用自己手動去建立任何資料夾**,「資料夾」只是這段規則內部用來分辨誰是誰的路徑寫法,系統會自動處理
   5. 執行成功會顯示類似「Success. No rows returned」的訊息,畫面不會有其他變化(不像跑 migration 後能在 Table Editor 看到新表格),這是正常的

### 4. 把設定值填進專案

1. 左側選單「Project Settings」→「API」,複製 **Project URL** 跟 **anon public** 這把 key
   - Supabase 後台新版介面裡,這把 key 改名叫「**Publishable key**」(`sb_publishable_...` 開頭),就是同一個東西
   - 同一頁還會看到「**Secret keys**」(`sb_secret_...` 開頭,舊稱 service_role key)——**不要用這把**,這是伺服器專用的最高權限金鑰,填進前端 `.env` 會直接外流,絕對不能用在這裡
2. 複製一份 [.env.example](.env.example) 改名成 `.env`,把值貼進去:
   ```
   VITE_SUPABASE_URL=你的 Project URL
   VITE_SUPABASE_ANON_KEY=你的 anon public key
   ```
   這把 key 不是密碼,可以放心寫在前端,真正的保護是靠第 1 步設定的 RLS 規則。

### 5. 本機安裝與啟動(需要先裝好 Node.js,建議 18 以上版本)

```bash
npm install
npm run dev
```

打開終端機顯示的網址(通常是 http://localhost:5173),就可以開始測試——先「建立新帳號」註冊一組帳號,再開始建客戶卡。

> 目前這台開發機器沒有安裝 Node.js/npm,所以這份程式碼還沒辦法在這裡直接跑起來驗證。程式邏輯(年齡計算、儲值餘額、月加總公式)已經個別用瀏覽器測試過是對的,但完整流程(登入、存檔、上傳照片)請在你自己有 Node.js 的電腦,或直接部署到 Vercel 後測試。

### 6. 部署到 Vercel

1. 把整個 `salon-crm` 資料夾放進 GitHub(自己一個新的 repo)
2. 到 https://vercel.com 用 GitHub 帳號登入,「Add New → Project」,選這個 repo
3. Framework Preset 選 **Vite**(或 Other,Vercel 通常會自動偵測),Build Command `npm run build`,Output Directory `dist`
4. 在 Vercel 專案的 Environment Variables 貼上 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`(跟 `.env` 一樣的值)
5. 部署完成後會得到一個 `xxx.vercel.app` 網址,之後同行要使用就是給他們這個網址,自己註冊帳號即可(不用你手動幫他們建帳號)

正式網域(例如 `你的品牌.com`)之後如果要用,自己去網域註冊商買好,再到 Vercel 專案設定裡「Domains」加進去、依指示改 DNS 即可,這不影響目前的架構。

## 後續新增功能怎麼套用到 Supabase(儲值編輯、同意書、消費確認簽名、服務/來源佔比、商品銷售)

### 懶人版(推薦,只要做一次)

不用一個一個檔案跑,也不用手動去 Storage 頁面建 bucket。打開 [supabase/apply_2026_08_updates.sql](supabase/apply_2026_08_updates.sql),全選複製整份內容,回 Supabase 後台「SQL Editor」開新查詢貼上,按一次「Run」就會把下面所有 SQL 異動 + 新的 `client-signatures` 檔案空間一次建好。這個檔案就算重複執行也不會報錯,不用擔心跑錯或跑兩次。

執行完如果最下面那段建立 Storage bucket 的地方報權限錯誤(少數專案設定會這樣),改成手動到「Storage」頁面新增一個叫 `client-signatures` 的 private bucket 就好,其他部分不受影響。

### 詳細版(想知道每一步在做什麼,或懶人版失敗時逐項排查用)

如果你的 Supabase 專案是照本文件第一次設定步驟(migration 0001-0003)建好的,後續新加的功能個別對應下面這幾個 SQL 檔案(內容跟懶人版合起來是一樣的,只是拆開)。做法比照第一次設定的第 1 步(SQL Editor 貼上執行),**按編號順序**依序跑完:

1. [supabase/migrations/0004_topup_audit_and_updatable.sql](supabase/migrations/0004_topup_audit_and_updatable.sql) — 讓儲值紀錄可以編輯
2. [supabase/migrations/0005_client_consent.sql](supabase/migrations/0005_client_consent.sql) — 同意書欄位、消費確認簽名欄位
3. [supabase/migrations/0006_service_mix_rpc.sql](supabase/migrations/0006_service_mix_rpc.sql) — 服務項目佔比
4. [supabase/migrations/0007_client_source.sql](supabase/migrations/0007_client_source.sql) — 客戶來源欄位與佔比
5. [supabase/migrations/0008_product_sales.sql](supabase/migrations/0008_product_sales.sql) — 商品銷售資料表
6. [supabase/migrations/0009_monthly_summary_products.sql](supabase/migrations/0009_monthly_summary_products.sql) — 月結算加入商品銷售
7. [supabase/migrations/0010_client_intake_fields.sql](supabase/migrations/0010_client_intake_fields.sql) — 把紙本「顧客服務同意書」的欄位(LINE ID、地址、基本狀況問卷、肌膚類型、拍照授權等)加到客戶卡

另外還要**手動建立第三個 Storage bucket**(比照第一次設定步驟 3):
1. Supabase 後台「Storage」,新增一個 bucket,名稱 `client-signatures`,**不要勾選 Public**
2. 回「SQL Editor」,重新執行一次 [supabase/storage_policies.sql](supabase/storage_policies.sql) 的完整內容(這個檔案已經更新過,包含新 bucket 的權限規則;重複執行舊的兩個 bucket 政策如果報錯「政策已存在」屬正常,忽略即可,或是只複製貼上檔案最後新增的 `client_signatures_isolation` 那一段單獨執行)

跑完以上,重新部署一次網站(GitHub 上傳新程式碼 → Vercel 自動重新部署,流程跟之前一樣),就可以使用這批新功能了。

### 想讓「上傳新程式碼」這步也變簡單:GitHub Desktop(選用)

目前每次程式改完,你都要把整個資料夾重新拖進 GitHub 網頁覆蓋,還要小心不要多包一層資料夾。如果覺得麻煩,可以花 5 分鐘裝一次「**GitHub Desktop**」(免費、純點擊操作,不用打指令):

1. 到 https://desktop.github.com 下載安裝,用你的 GitHub 帳號登入
2. 「File → Add Local Repository」,選你電腦上的 `salon-crm` 資料夾,連到你原本那個 GitHub repo
3. 以後我改完程式碼,你只要打開 GitHub Desktop,它會自動列出哪些檔案改了,下方填一句說明文字,按左下角「**Commit to main**」,再按「**Push origin**」——兩個按鈕就完成上傳,不用再手動拖資料夾,也不會再有多包一層資料夾的問題

這是選用的,不裝也完全沒關係,原本拖曳上傳的方式繼續可以用。

## 開店前要注意的事

- **Supabase 免費方案**閒置約一週會自動暫停專案(重新開啟只要在後台按一下,不會遺失資料,但客戶那端會暫時打不開)。開發、demo 階段沒關係,但**等真的有第一個付費客戶正式上線用之前,記得先升級付費方案($25/月起)**,才不會因為某天沒人用就暫停。
- PWA 圖示(`public/icons/icon-192.png`、`icon-512.png`)目前直接沿用原型裡的圖示,兩個檔案其實是同一張圖沒有分別縮放,能用但不是最佳畫質,之後可以換成正式 Logo 重新輸出兩個尺寸。
- 目前只有「建立帳號」流程,沒有「忘記密碼」頁面——密碼忘記的話,先到 Supabase 後台「Authentication → Users」手動幫使用者重設,之後有需要可以再加自助重設密碼的功能。

## 檔案結構

- `src/main.js` — 整個 App 的路由/狀態機,決定目前要顯示哪個畫面
- `src/supabaseClient.js` — 唯一的 Supabase 連線入口
- `src/lib/` — 共用邏輯:`calcAge.js`(年齡計算,原樣搬自原型)、`photoCompress.js`(照片壓縮)、`auth.js`(登入/註冊/建立 salon)、`data.js`(所有資料庫讀寫)、`services.js`(固定服務項目清單)、`sources.js`(客戶來源選項)、`passwordToggle.js`(密碼欄位眼睛圖示)
- `src/pages/` — 每個畫面一個檔案:登入、註冊、客戶列表、客戶詳情、客戶表單、帳本、營收總覽、設定(同意書範本編輯);到店紀錄拆成 4 個檔案(`visitForm.js` 填資料 → `visitConsent.js` 同意書簽名,只有第一次到店會出現 → `visitConfirm.js` 消費確認簽名,每次到店都有 → `visitMaterialCost.js` 店主輸入材料費、真正存檔)
- `src/components/` — 共用元件(簽名板、服務多選 chips、生日提醒區塊、底部 tab bar、商品銷售 modal)
- `src/styles/theme.css` — 米杏色系視覺樣式,原樣沿用原型的配色
- `supabase/migrations/` — 資料庫結構、帳號隔離規則、查詢函式(SQL 檔案,對照上面設定步驟 1)
- `supabase/storage_policies.sql` — 照片/簽名檔案的存取權限規則(對照設定步驟 3)

## 之後想調整

- **服務項目**:目前 6 個固定選項寫在 `src/lib/services.js`,想改名稱/顏色直接改這裡就好;想做成每家店可以自訂,需要另外加資料表跟管理畫面。
- **儲值扣款餘額不足**:目前是提示但不擋單(`src/pages/visitForm.js` 的 `checkBalanceWarning`),如果想改成強制擋下不能儲存,在儲存前加一個判斷擋掉即可。
- **多員工登入同一家店**:資料庫已經把 `salons` 拆成獨立表(不是直接綁 `auth.users`),之後要加這個功能,主要是改 RLS 政策從「owner_user_id = auth.uid()」改成「使用者屬於這個 salon 的員工名單」,不用整個重寫。
