# LEMATEC ERP Data Flow

## Current Effective Inventory Rule 2026-07-28

This section overrides older Supabase inventory notes below if they conflict.

- Inventory is intended to be Supabase-first through the Cloudflare Worker.
- Normal staff devices do not need a Supabase anon public key to browse inventory.
- Frontend inventory read calls Worker route `GET /api/inventory/list`.
- Worker reads Supabase `materials` and `inventory_balances` with the service role key.
- Inventory quantity writes call Worker routes such as `POST /api/inventory/adjust` or `POST /api/inventory/sync`.
- Inventory master creation and metadata edits write Supabase first, then mirror to Notion.
- Inventory master deletion, duplicate cleanup, and merge use the atomic Supabase RPC `archive_inventory_materials`.
- The archive RPC locks the affected rows and rejects non-zero inventory or active BOM references unless the caller explicitly supplies an approved merge plan.
- A rejected or failed Supabase operation must not archive the Notion page or report success.
- Supabase must accept the inventory write before the ERP shows success.
- After Supabase accepts a write, Notion is updated as a staff-readable mirror/backup.
- If the Notion mirror temporarily fails, the ERP stores a retry task and continues retrying without undoing the accepted Supabase truth.
- If Worker/Supabase inventory read fails, the frontend may fall back to Notion so staff are not blocked.
- The local `lematec_supabase_anon_key` is only for optional health-check diagnostics such as deeper BOM view comparison. It is not required for normal inventory browsing or editing.
- Do not claim Notion manual edits are fully two-way until a verified Notion-to-Supabase sync job exists.

最後更新：2026-07-28

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
| 庫存主檔 | Supabase | Worker 讀 Supabase；失敗才回退 Notion | Worker 先寫 Supabase；成功後鏡像 Notion | 查閱、鏡像與備援 | 正式主資料 |
| BOM / 子母件 | Supabase + Notion 鏡像 | 交易與封存檢查使用 Supabase BOM | 既有 BOM 維護流程須同步兩邊 | 查閱與鏡像 | 扣料、關聯與封存安全檢查 |
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

1. 前端呼叫 Worker `GET /api/inventory/list`。
2. Worker 以 service role 讀取 Supabase 料號、庫存餘額與必要的 BOM 資料。
3. 正常瀏覽與修改不需要在每台裝置輸入 anon public key。
4. Worker/Supabase 暫時無法讀取時，前端才可使用 Notion 快取作為唯讀備援，並清楚顯示目前為備援資料。
5. 備援狀態不得執行庫存修改、刪除或合併，以免產生雙主資料。

## 庫存主檔寫入與鏡像流程

目前庫存主檔操作以 Supabase 為先：

1. 新增料號：先呼叫 Worker 寫入 Supabase，再建立 Notion 鏡像；若全新 Supabase 料號的 Notion 建立失敗，前端會安全回滾該新料號。
2. 修改料號名稱、類型或中英文名稱：先寫 Supabase，成功後更新 Notion；Notion 暫時失敗時加入重試佇列。
3. 修改庫存數量：透過 Worker 的庫存調整/同步路由寫入 Supabase，再鏡像 Notion 並建立異動紀錄。
4. 刪除、重複清理、合併：呼叫 Worker `POST /api/inventory/material/archive`，由 Supabase RPC 在單一交易中鎖定並檢查料號、庫存與 BOM。
5. 只要庫存非零、BOM 關聯未被核准、資料衝突或資料庫錯誤，整筆操作失敗，不封存 Notion、不顯示成功。
6. Supabase 成功後才封存 Notion 鏡像；Notion 暫時失敗時加入 `lematec_workflow_notion_queue_v1` 重試。
7. 前端不可持有 PostgreSQL DB URL、postgres 密碼或 service role key。

重點：日常料號與庫存操作請使用 ERP 前端。直接在 Notion 修改目前仍不保證即時回寫 Supabase。

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
