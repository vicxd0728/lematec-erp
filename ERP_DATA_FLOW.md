# LEMATEC ERP Data Flow

## Current Effective Inventory Rule 2026-07-27

This section overrides older Supabase inventory notes below if they conflict.

- Inventory is intended to be Supabase-first through the Cloudflare Worker.
- Normal staff devices do not need a Supabase anon public key to browse inventory.
- Frontend inventory read calls Worker route `GET /api/inventory/list`.
- Worker reads Supabase `materials` and `inventory_balances` with the service role key.
- Inventory quantity writes call Worker routes such as `POST /api/inventory/adjust` or `POST /api/inventory/sync`.
- Supabase must accept the inventory write before the ERP shows success.
- After Supabase accepts a write, Notion is updated as a staff-readable mirror/backup.
- If Worker/Supabase inventory read fails, the frontend may fall back to Notion so staff are not blocked.
- The local `lematec_supabase_anon_key` is only for optional health-check diagnostics such as deeper BOM view comparison. It is not required for normal inventory browsing or editing.
- Do not claim Notion manual edits are fully two-way until a verified Notion-to-Supabase sync job exists.

最後更新：2026-07-27

本文件定義 ERP 前端、Notion、Supabase 之間的資料責任。實際程式仍以 `index.html` 為準；若程式改變，需同步更新本文件。

## 原則

- 前端 ERP 是主要操作入口。
- Notion 仍保留為人員查閱、稽核、備援的可視化後台。
- Supabase 用於速度敏感、資料量會變大的模組。
- 任一模組切換成 Supabase 主資料前，必須先有雙軌驗證與回復方案。
- Supabase 寫入後，若該資料仍有人員查閱需求，必須回寫或補同步到 Notion。

## Supabase Public Key

前端只使用 Supabase anon public key，不使用 PostgreSQL DB URL。

目前 key 儲存在瀏覽器 localStorage：

- key 名稱：`lematec_supabase_anon_key`
- 設定入口：健康檢查或庫存資料來源區

行為：

- 沒有 anon public key：不讀 Supabase REST，庫存頁使用 Notion 正式資料。
- 有 anon public key：可啟用 Supabase 優先的只讀快照。
- 若 Supabase REST 失敗：對應模組需 fallback 到 Notion 或備援清單。

## 模組狀態

| 模組 | 目前主資料 | 前端讀取 | 前端寫入 | Notion 角色 | Supabase 角色 |
|---|---|---|---|---|---|
| 庫存主檔 | Notion | Notion 正式；可切 Supabase 優先只讀 | Notion 主流程；新增料號與庫存數量變更會自動鏡像 Supabase | 正式操作與查閱 | 只讀快照、速度測試、遷移驗證、前端庫存鏡像 |
| BOM / 子母件 | Notion | Notion | Notion | 正式操作與查閱 | 遷移驗證與未來候選主資料 |
| 異動紀錄 | Supabase 轉換中 | 有 key 時優先 Supabase，失敗回 Notion | Supabase；需鏡像 Notion | 人員查閱鏡像 | 主讀寫與速度來源 |
| 影片庫 | Supabase | Supabase 優先；失敗回備援清單 | 目前非前端日常寫入 | 可作資料備援 | 主資料與快速搜尋 |
| 記事 | Notion | Notion / 前端快取 | Notion | 正式紀錄、客戶頁關聯 | 未切換 |
| 訂單 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| C端訂單 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| 領料 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| 入料 / 品管 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| 請假 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| 客戶 | Notion | Notion | Notion | 正式紀錄 | 未切換 |

## 庫存讀取流程

目前庫存頁邏輯：

1. `getInventoryReadSource()` 讀本機設定。
2. 若本機沒有明確設定：
   - 有 Supabase anon key：預設 `supabase`
   - 沒有 Supabase anon key：預設 `notion`
3. 若選 Supabase 且快照已載入成功，庫存頁使用 `inventory_snapshot`。
4. 若 Supabase 未載入、失敗、或沒有 key，庫存頁使用 Notion `mats` 快取。
5. Supabase 模式只讀，會禁止庫存修改與料號刪除。

重點：Supabase 優先目前只影響庫存頁顯示/搜尋，不代表訂單扣料已切 Supabase。

## 庫存寫入鏡像流程

目前前端庫存寫入仍先走 Notion 正式流程；成功後會自動送出 Supabase 鏡像任務：

1. 新增料號：`createPage(DB.materials, ...)` 成功後，建立 `upsert_material` 任務。
2. 修改庫存數量：`updatePage(..., {'目前庫存': ...})` 成功後，建立 `set_stock` 任務。
3. 前端會把任務存在本機 `lematec_inventory_mirror_queue_v1`，並透過 Worker `/api/inventory/sync` 寫入 Supabase。
4. Worker 必須設定 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`，由 Worker 使用 service role 寫入，前端不接觸 DB 密碼。
5. 若 Worker、網路或 Supabase 暫時失敗，Notion 主流程不回滾，任務留在本機佇列，登入或回到前景時自動重試。

重點：這是「Notion 主流程 + Supabase 鏡像」階段，還不是完整 Supabase 主資料切換。訂單扣料、BOM、入料、品管等完整庫存服務仍需 Phase 4 才能正式切成 Supabase 主資料。

## 異動紀錄流程

目前異動紀錄邏輯：

1. 有 Supabase anon key 時，先讀 `stock_logs_public`。
2. Supabase 讀取失敗時，fallback 到 Notion 異動紀錄資料庫。
3. 前端操作產生異動時，應優先寫 `erp_stock_logs`。
4. Notion 仍需鏡像，以便非技術人員查閱。

下一步建議：

- 保留 Supabase to Notion mirror script。
- 加入補同步佇列或定期同步，避免只存在 Supabase。
- 回填舊 Notion 異動紀錄到 Supabase 前，先讓新資料跑一段時間確認穩定。

## 庫存搬遷啟動條件

正式把庫存切成 Supabase 主資料前，需完成：

- Notion 與 Supabase 料號、類型、數量、BOM 差異為 0 或有明確例外清單。
- 前端所有庫存寫入路徑已改成 Supabase：新增料號、修改數量、刪除/封存、BOM、訂單扣料、領料、入料、品管入庫、C端流程。
- Supabase to Notion mirror 可補同步。
- 有回復方案：可在短時間內切回 Notion 正式。
- 有批量操作節流，避免 Notion/Supabase rate limit。

## 常見風險

- 只改庫存頁讀取，未改訂單扣料，會造成畫面看 Supabase、實際扣 Notion 的雙資料源錯覺。
- 人員若直接在 Notion 修改庫存，Supabase 不會自動知道，除非建立 Notion to Supabase 同步流程。
- Supabase anon key 是公開讀取/受 RLS 控制的 key，不等於 DB 密碼。
- 若 RLS/view 權限改錯，前端會顯示 permission denied，應修 Supabase policy/view 權限，不要把 DB 密碼放進前端。

## 建議協作方式

現階段：

- 日常庫存操作：ERP 前端或由 Codex 批量操作 Notion。
- Notion：查閱與人工稽核。
- Supabase：只讀驗證、速度測試、異動紀錄主資料試行、前端庫存鏡像。

未來切換後：

- ERP 前端：唯一正式庫存操作入口。
- Supabase：庫存/BOM/異動紀錄主資料。
- Notion：由同步機制鏡像，供查閱。
