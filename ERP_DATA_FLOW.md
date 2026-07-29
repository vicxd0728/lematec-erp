# LEMATEC ERP Data Flow

## Conditional Core Sync 2026-07-28

- Inventory and BOM remain Supabase-first through the Cloudflare Worker.
- Each automatic sync first calls `GET /api/inventory/versions`.
- The frontend downloads the full inventory or BOM payload only when its version changed, local data is empty, or the user starts a manual forced sync.
- A temporary version-check failure keeps the last known inventory and BOM in memory. It must not clear data or report a false successful refresh.
- Full payload requests include a revision query. The Worker caches immutable revision URLs for seven days and returns `X-ERP-Cache` and `X-ERP-Data-Version` headers.
- The version endpoint is cached briefly to reduce repeated Supabase metadata reads.
- Order data remains on its existing Notion path and is refreshed independently of unchanged inventory and BOM data.
- Manual sync remains available and intentionally performs a full inventory and BOM refresh.

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
- Mirror retry tasks are stored both in the current browser and in Supabase
  `erp_mirror_jobs`. A signed-in device can recover unfinished mirror work after
  a restart; `organization_id + dedupe_key` prevents duplicate repair jobs.
- If Worker/Supabase inventory read fails, the frontend may fall back to Notion so staff are not blocked.
- BOM reads call Worker route `GET /api/inventory/bom/list` and use Supabase first.
- BOM imports and automatic Shopee BOM creation call Worker route `POST /api/inventory/bom/upsert`.
- Every BOM write validates parent SKU, component SKU, positive quantity, duplicate pairs, and self references before writing.
- Supabase must accept the complete submitted BOM plan and return the exact row count before any Notion BOM mirror is changed.
- A failed Supabase BOM write stops the operation and leaves Notion untouched.
- After Supabase accepts a BOM write, Notion is updated as a staff-readable mirror. A temporary Notion failure is queued for retry and does not roll back Supabase.
- The retired `lematec_pending_bom_snapshot_v1` queue is deleted on load and is never replayed, preventing an older Notion snapshot from overwriting current Supabase BOM data.
- Supabase BOM is accepted only when it is non-empty and every parent, component, quantity, and pair can be mapped safely.
- If Supabase BOM is empty, malformed, duplicated, self-referencing, or cannot map to the loaded material master, the frontend rejects it and loads the Notion BOM mirror as an explicit fallback.
- If both Supabase and Notion BOM reads fail, BOM-dependent picking and deduction remain blocked.
- The local `lematec_supabase_anon_key` is only for optional health-check diagnostics such as deeper BOM view comparison. It is not required for normal inventory browsing or editing.
- Do not claim Notion manual edits are fully two-way until a verified Notion-to-Supabase sync job exists.

## Batch Inventory Adjustment 2026-07-29

- Entry: Inventory page > `批量調整`.
- Allowed roles: Vic, manager, warehouse, and sales. View-only users cannot submit it.
- Scope: existing Supabase materials only. Creating new materials stays in the separate material workflow.
- Input: paste `SKU +10` / `SKU -5`, set final quantities, or import the first Excel/CSV sheet.
- Excel template: choose the adjustment mode first, then click `下載 Excel 範本`. The first sheet contains only the fixed import headers; examples and rules are kept on the second sheet so sample SKUs cannot be imported accidentally.
- Template columns: delta mode uses `料號` + `異動量`; set mode uses `料號` + `修改後數量`. The shared reason remains a required ERP field and is not read from Excel.
- Required: a reason and 1-100 unique materials.
- Preflight blocks unknown SKUs, missing Notion mirrors, duplicates, non-integer values, no-op changes, and negative final stock.
- Commit: Worker calls `apply_inventory_batch`; PostgreSQL locks all balances and commits the complete batch in one transaction.
- Audit: every material creates an inventory transaction under the same batch idempotency prefix.
- Mirror: Notion is updated after Supabase commits. Temporary mirror failures remain in the retry queue.

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
| BOM / 子母件 | Supabase | Worker 優先讀 Supabase；驗證失敗才回退 Notion | ERP 維護 Notion 鏡像後，必須把完整驗證快照同步到 Supabase 才算成功 | 查閱、鏡像與緊急備援 | 正式領料、扣料、關聯與封存安全檢查 |
| 異動紀錄 | Supabase | Worker 讀 Supabase，預設近 30 天並支援分頁 | Worker 先寫 Supabase；成功後鏡像 Notion | 人員查閱鏡像，不作正式 fallback | 正式唯一主資料 |
| 影片庫 | Supabase | Supabase 優先；失敗回備援清單 | 目前非前端日常寫入 | 可作資料備援 | 主資料與快速搜尋 |
| 記事 | Notion | Notion / 前端快取 | Notion | 正式紀錄、客戶頁關聯 | 未切換 |
| 訂單 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| C端訂單 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| 領料 | Supabase | Worker 讀 Supabase；失敗時 Notion 僅作唯讀備援 | Worker 先寫 Supabase；成功後建立或更新 Notion 鏡像 | 人員查閱鏡像與緊急唯讀備援 | 正式主單、明細、狀態與防重依據 |
| 入料 / 品管 | Supabase | Worker 讀 Supabase；失敗時 Notion 僅作唯讀備援 | Worker 先寫 Supabase；成功後鏡像 Notion | 人員查閱鏡像與緊急唯讀備援 | 正式主單、明細、品檢狀態與入庫防重依據 |
| 請假 | Notion | Notion | Notion | 正式紀錄 | 未切換 |
| 客戶 | Notion | Notion | Notion | 正式紀錄 | 未切換 |

### 領料正式流程（2026-07-29）

- 已將 126 張有效領料主單與 279 筆領料明細匯入 Supabase，主單與明細的 Notion page ID 均無缺漏。
- 原始 Notion 共 127 張主單；其中 1 張完全空白且沒有任何明細，已列入排除清單，未偽造成有效領料單。
- 7 筆舊明細沒有可安全確認的正式料號關聯，僅保留為歷史資料，不猜測對應料號。
- 重複的歷史領料單號會依不同 Notion page ID 分別保留，不會合併或覆蓋。
- 前端領料查詢改由 Worker `GET /api/picking/list` 讀取 Supabase；若服務暫時失敗，可顯示 Notion 唯讀備援，但不得從備援資料執行扣庫存。
- 訂單領料以訂單 Notion page ID 作為唯一來源鍵；重複點擊會續接同一張 Supabase 領料單，不會建立第二張或重新扣庫存。
- 臨時補料以唯一領料單號建立 Supabase 主單與明細，完成時使用該 Supabase 主單 ID 作為庫存交易防重來源。
- 建立順序為：Supabase 建立/續接領料單 → Notion 建立查閱鏡像 → Supabase 原子批次扣庫存 → Supabase 更新已領料 → Notion 鏡像補狀態。
- 缺料、BOM 缺件、Supabase 寫入失敗或 Notion 首次鏡像失敗時，不開始扣庫存；已扣庫後發生斷線則以固定 idempotency key 續跑，不得重扣。
- Notion 鏡像會把主單與明細 page ID 回標至 Supabase。新流程建立但鏡像未完成的單據，領料頁載入後會限量自動補同步。

### 入料正式流程（2026-07-29）

- 已將 1,048 張入料主單與 1,048 筆入料明細匯入 Supabase，主單缺少 Notion page ID 為 0。
- 44 組歷史重複入料單號依各自 Notion page ID 分別保留，不合併、不覆蓋。
- 24 筆無法安全對應正式料號的歷史明細以 null material relation 保存，只供查閱，不得拿來執行新入庫。
- 歷史搬遷不重播庫存交易，避免把已經入過庫的數量再增加一次。
- 前端入料頁由 Worker `GET /api/inbound/list` 讀取 Supabase；Worker 暫時失敗時只顯示 Notion 唯讀備援，不開放品檢、退回或重新提交。
- 建立入料時先寫 Supabase 主單與明細，再建立 Notion 查閱鏡像並把 page ID 回標至 Supabase。
- 退回與重新提交先更新 Supabase，再鏡像 Notion；已經有庫存交易的入料單不得退回或重新提交。
- 品檢通過使用 Supabase 原子庫存交易，固定防重鍵為 `inbound_qc_pass:<Supabase 入料主單 ID>`。
- Supabase 成功後才顯示入庫成功；Notion 鏡像暫時失敗時保留 Supabase 正式結果並排入補同步，不得再次增加庫存。
- 詳細操作、驗證與回復規則見 `supabase/INBOUND_RUNBOOK.md`。

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

## BOM 正式讀取流程

1. ERP 核心載入時，同時請求 Supabase 庫存、Supabase BOM 與 Notion 訂單，避免把網路等待時間串接。
2. BOM 由 Worker `GET /api/inventory/bom/list` 讀取 Supabase `bom_headers` 與 `bom_items`。
3. 前端以 Notion page ID 優先對應料號，必要時才用標準化料號補對應。
4. 只要有任一筆缺母件、缺子件、用量小於等於 0、自我關聯或重複關聯，整批 Supabase BOM 不採用。
5. Supabase BOM 無法安全採用時，前端自動改讀 Notion BOM 鏡像，健康檢查會標示 `Notion 備援資料`。
6. Supabase 與 Notion 都無法提供非空 BOM 時，`_bomDataReady` 保持失敗，領料預覽與扣料會停止。
7. 訂單與領料仍可保留在 Notion；其成品 relation 使用的 Notion page ID 會與 Supabase material 的 `notion_page_id` 對齊，因此可直接套用 Supabase BOM。

## BOM 維護與補同步

1. ERP 的 BOM Excel、蝦皮 BOM 與自動建立 BOM 流程會先更新 Notion 人工查閱鏡像。
2. 更新後，前端以目前完整料號與 BOM 建立快照，拒絕空資料、缺少 page ID、自我關聯、重複關聯及非正數用量。
3. 快照由 Worker `POST /api/inventory/bom/migrate` 寫入 Supabase，回傳筆數必須與送出筆數完全相同才算成功。
4. 寫入失敗會自動重試 3 次，並把完整快照保留在目前裝置的 `localStorage`。
5. 只要仍有待補同步快照，下一次核心載入會先補送；補送失敗時，BOM 相關領料與扣料保持阻擋。
6. 直接在 Notion 手動修改 BOM 目前不會自動推送 Supabase；正式維護請使用 ERP 的 BOM 匯入與管理流程。

## 異動紀錄流程

目前異動紀錄正式邏輯：

1. 前端透過 Worker `GET /api/stock-log/list` 讀取 Supabase，不需要 anon public key。
2. 第一次只載入近 30 天；選擇全部或搜尋舊資料時再用 `offset` 分頁載入。
3. 每次庫存異動先透過 Worker `POST /api/stock-log/sync` 寫入 Supabase，並以 `client_trace_id` 防止重送造成重複。
4. Supabase 寫入失敗時不先寫 Notion，也不回報假成功。
5. Supabase 成功後建立 Notion 查閱鏡像，再以 `POST /api/stock-log/mark-notion` 把 page id 回標至 Supabase。
6. Notion 暫時失敗時，前端重試佇列與每六小時 GitHub Actions 補同步；排程會先查既有頁面，避免重複建立。
7. 舊 Notion 異動紀錄已用 `notion_page_id` 去重回填 Supabase，後續增量可用 Worker 模式安全補回填。

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
- Notion 暫時失敗不代表庫存交易失敗。健康檢查的「資料可靠性中心」
  會列出待補同步、重試失敗與缺少 Notion page id 的資料；不可用再次
  執行扣料或入庫來修復鏡像。

## 可靠性中心與補同步

1. 庫存、BOM、領料或入料主流程必須先由 Supabase 接受。
2. Notion 鏡像失敗時，前端保留本機工作並上傳至 Supabase
   `erp_mirror_jobs`。
3. 新登入或重新開啟 ERP 時會取回未完成工作，再執行 Notion 鏡像。
4. 同一工作使用固定 `dedupe_key`，不得建立多筆補同步。
5. 失敗採指數退避；五次失敗會列為健康檢查錯誤，等待人工重新補同步。
6. 補同步只處理 Notion 鏡像，不得重播 Supabase 庫存交易。
7. 詳細處理方式見 `supabase/RELIABILITY_RUNBOOK.md`。

## 建議協作方式

目前：

- ERP 前端：庫存、BOM、異動紀錄、領料與入料的正式操作入口。
- Supabase：上述模組的主資料與交易來源。
- Notion：由同步機制維持人工查閱鏡像；直接修改不保證回寫 Supabase。
- 其他尚未遷移的模組仍依本文件上方資料主從表執行。
