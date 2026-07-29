# LEMATEC ERP Codex Handoff

最後更新：2026-07-29

這份文件是每次接手 LEMATEC ERP 任務時的第一份交接。先讀它，再讀實際程式與資料流文件，避免靠舊聊天記憶猜流程。

## 專案位置

- 本機專案：`C:\Users\vicxd\Documents\Codex\2026-05-21\new-chat\lematec-erp`
- 主前端：`C:\Users\vicxd\Documents\Codex\2026-05-21\new-chat\lematec-erp\index.html`
- 線上網址：https://lematec-erp.pages.dev/
- GitHub：https://github.com/vicxd0728/lematec-erp
- Cloudflare Pages 專案：`lematec-erp`
- Notion API proxy Worker：`https://green-wave-c22f.vic-e93.workers.dev`
- Worker 完整檔案：`cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`

## 接手順序

1. `git status --short`，確認工作區是否有未提交變更。
2. 讀 `CODEX_HANDOFF.md`。
3. 讀 `ERP_DATA_FLOW.md`。
4. 若任務與 Supabase、庫存、BOM 有關，讀 `SUPABASE_INVENTORY_MIGRATION_PLAN.md`。
5. 若任務與異動紀錄有關，讀 `supabase\STOCK_LOG_RUNBOOK.md`。
6. 若任務與領料、補料、訂單扣料或領料搬遷有關，讀 `supabase\PICKING_RUNBOOK.md`。
7. 再讀 `index.html` 的相關函式，依實際程式為準。

不要回復或修改無關的 dirty files。不要印出 token、DB URL、Cloudflare token、Notion token。

## 目前資料主從

詳細規則在 `ERP_DATA_FLOW.md`。簡版如下：

- Notion 仍是多數非庫存模組的正式資料源與人員查閱後台。
- 庫存主檔、庫存餘額與相關交易以 Supabase 為主，前端透過 Worker 讀寫，不要求每台裝置設定 anon key。
- 料號建立、修改、刪除、重複清理與合併皆為 Supabase 優先；Supabase 成功後才鏡像 Notion。
- 刪除與合併使用 Supabase 原子 RPC；非零庫存或未核准的 BOM 關聯一律拒絕，不允許部分成功。
- Notion 鏡像失敗會排入前端重試佇列；Supabase 失敗則整個主操作失敗。
- 直接在 Notion 修改庫存目前仍不保證自動回寫 Supabase，日常操作以 ERP 前端為準。
- 異動紀錄正在轉向 Supabase 主讀寫，Notion 需同步保留鏡像，供人員查閱。
- 影片庫優先讀 Supabase，失敗時退回備援清單。
- BOM 正式讀取已改為 Worker / Supabase 優先；前端會逐筆驗證母件、子件、用量與重複關聯，失敗時才使用 Notion BOM 鏡像。
- Supabase 與 Notion BOM 都無法安全載入時，領料與扣料必須保持阻擋，不得用空 BOM 繼續。
- ERP 內的 BOM 匯入與自動建立必須先透過 Worker `POST /api/inventory/bom/upsert` 寫入 Supabase 並核對筆數；Supabase 失敗時不得先改 Notion。
- Supabase 接受 BOM 後才更新 Notion 查閱鏡像；Notion 鏡像失敗會排入 `lematec_pending_bom_notion_mirror_v1` 重試佇列。
- 舊的 `lematec_pending_bom_snapshot_v1` 不得再回放到 Supabase，登入時只清除，避免舊 Notion 快照覆蓋正式 BOM。
- 不得宣稱直接在 Notion 手動改 BOM 會自動回寫 Supabase；目前正式 BOM 維護入口是 ERP 前端。
- 領料歷史資料已在 2026-07-29 搬入 Supabase 並逐筆驗證：126 張有效主單、279 筆明細。
- 領料正式流程已切成 Supabase 主讀寫：訂單領料與臨時補料先建立或續接同一張 Supabase 主單，再建立 Notion 查閱鏡像。
- 訂單本身仍在 Notion；領料主單用訂單 Notion page ID 存入 `source_order_notion_page_id`，作為跨資料庫穩定關聯與防重鍵。
- 扣庫存沿用 Supabase 原子批次與 idempotency key。重複點擊、斷線重試或鏡像補同步不得重複扣料；Supabase 領料服務失敗時，Notion 備援只允許查閱，不允許完成扣料。
- Notion 領料鏡像若暫時失敗，Supabase 主單保留，後續載入領料頁會自動補同步；鏡像完成前不開始新的扣庫存交易。
- 領料搬遷保留 7 筆無法安全對應正式料號的舊明細作為歷史紀錄；不得拿它們作為新領料扣庫存依據。另有 1 張完全空白且無明細的 Notion 歷史頁已明確排除。
- 領料搬遷工具為 `scripts/supabase_picking_migrate_via_worker.py`，可重跑且以 Notion page ID 去重；最近通過報表位於 `supabase/picking_migration_exports/20260729-092231/picking_migration_report.json`。

## Supabase Key 行為

前端使用的是 Supabase anon public key，存在瀏覽器 `localStorage` 的 `lematec_supabase_anon_key`。

- 沒有 key：一般庫存瀏覽與修改仍透過 Worker 使用 Supabase，不受影響。
- 有 key：只增加健康檢查中的 Supabase REST 深度比對能力。
- 異動紀錄有 key 時會先讀 Supabase，失敗再退回 Notion。
- 前端不可使用 PostgreSQL DB URL 或 postgres 密碼。
- 前端庫存讀寫不靠 anon key；它會呼叫 Worker 庫存 API，由 Worker 內部的 `SUPABASE_SERVICE_ROLE_KEY` 存取 Supabase。

## 核心流程規則

### BOM / 庫存

- 成品訂單扣成品直接掛的半成品與零件。
- 成品直接掛半成品時，只扣該半成品本身，不再展開半成品底下零件。
- 半成品組立單扣零件，完成後增加半成品庫存。
- 外購成品若沒有 BOM，就只扣該成品本身。
- 零件料號原則上統一 `Y-` 開頭；若改名，必須同步 BOM、入料、訂單、領料等引用。

### C 端 / 蝦皮

- C 端使用 `S-` 料號作為獨立庫存層。
- C 端匯入 Excel 時，SHPTW 內部單號依設定起始值自動遞增。
- 物流/運送單上傳後，依蝦皮訂單號回填客戶名稱與寄件編號；客戶名稱可含 `*`。
- 物流來源優先看檔名；檔名不足時再解析內容。

### 權限

- Vic 與廠長可介入所有流程。
- 倉管與採購兼生管，需能處理生產中到待檢驗，以及蝦皮 S- 訂單完成入庫。
- 業務可查庫存並可修改庫存數量。
- 每個角色都需可看請假與異常紀錄。
- 檢視角色只看不改。

### 記事

- 記事需支援指定角色、回覆、已讀/待處理、完成、重要程度、提醒/到期。
- 被指定角色打開記事後可判定已讀；新回覆應重新提醒相關角色。
- 客戶關聯可用客戶編號連回客戶總檔；若同步到客戶頁，單一記事應在同一頁往下追加紀錄，不要每次新增分散頁。

## 驗證

常用檢查：

```powershell
git status --short
python .\scripts\verify_erp_static.py
```

前端改動後，至少檢查：

- 桌面版和手機版主要分頁不破版。
- 角色切換後可見頁面與操作權限正確。
- Notion / Supabase fallback 不因缺 key 失效。
- GitHub Actions build/deploy 結果。

## 部署

一般流程：

```powershell
git add -- <changed-files>
git commit -m "<message>"
git push origin main
```

GitHub Actions 成功後 Cloudflare Pages 會更新 `https://lematec-erp.pages.dev/`。

若 build 成功但 deploy 失敗，優先查：

- GitHub Secret `CLOUDFLARE_API_TOKEN`
- Cloudflare Pages project 名稱是否仍為 `lematec-erp`
- `.github/workflows/cloudflare-pages.yml`
- token 是否具備 Pages Read / Pages Write

## 相關文件

- `ERP_DATA_FLOW.md`
- `SUPABASE_INVENTORY_MIGRATION_PLAN.md`
- `supabase\STOCK_LOG_RUNBOOK.md`
- `ERP_OPEN_SOURCE_REFERENCES.md`
- `ERP_REGRESSION_CHECKLIST.md`
