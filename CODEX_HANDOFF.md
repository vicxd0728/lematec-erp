# LEMATEC ERP Codex Handoff

## Context Guard 2026-08-03

- Recommendation: start a new Codex chat before the next ERP code/data change.
- Reason: this thread has accumulated production-critical changes across Supabase, Notion mirrors, inventory, BOM, picking, inbound, C-end orders, Notes, Worker routes, Pages deployment, and local skills. Continuing major changes here increases the risk of acting from stale chat assumptions.
- Next chat first action: read `ERP_CURRENT_STATE.md`, then this file, `ERP_SYSTEM_CONTRACT.md`, `WORKER_API_CONTRACT.md`, `ERP_DATA_FLOW.md`, then the module runbook for the touched workflow before editing.
- Current source folder: `C:\Users\vicxd\Documents\Codex\2026-05-21\new-chat\lematec-erp`.
- Production URL: `https://lematec-erp.pages.dev/`.
- Worker source file: `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.
- Current risk posture: do not deploy or mutate production data until `git status --short` is reviewed and the exact changed workflow is verified against tests and no-side-effect production checks.
- Important live rule: inventory, BOM, picking, inbound, stock logs, and Notes structured data are intended to be Supabase-primary through the Worker, with Notion as staff-readable mirror/fallback according to `ERP_DATA_FLOW.md`. Direct Notion edits are not automatically trusted as two-way truth unless a verified Notion-to-Supabase sync path exists for that module.
- C-order numbering reminder: SHPTW sequence migration and Worker route are verified live as of 2026-08-04. Use `GET /api/corder/number-state` for no-side-effect checks; do not casually call allocation routes because they advance sequence state. Manual next-number correction must use the shared Worker/Supabase path and move forward only, not per-device localStorage.
- Handoff hygiene: there are many local temp/report files and backups in the worktree. Do not delete or revert anything without first separating generated artifacts from active source changes.

## Current Contract Docs 2026-08-03

- `ERP_CURRENT_STATE.md` is the single current-state entry point. Prefer it over older timeline notes when a status conflicts.
- `ERP_SYSTEM_CONTRACT.md` is the current operating contract: source of truth, module ownership, fallback rules, transaction rules, known blockers, validation gates, and optimization queue.
- `WORKER_API_CONTRACT.md` classifies Worker routes by side effect and production safety. Check it before calling production endpoints.
- These contract files do not replace `CODEX_HANDOFF.md`; they keep the current state compact while this file remains the timeline.

## Reliability Center v1 2026-08-03

- Health Check now shows `補同步中心 v1`.
- The panel combines local mirror queues, Notes Supabase shadow retries, stock-log pending retries, and server-side `erp_mirror_jobs` when the summary includes job rows.
- Actions are split into `全部補同步`, `鏡像補同步`, `記事補同步`, and `異動記錄補同步`.
- The all-retry action only calls existing retry/flush helpers. It does not call high-risk transaction routes such as C-order number reservation, inventory adjustment, or inbound action routes.
- Regression coverage was refreshed in `tests/test_reliability_center.py`.
- Validation passed:
  `python -m pytest tests/test_reliability_center.py`,
  `python -m unittest tests.test_verify_erp_static tests.test_notes_shadow_contract tests.test_notes_attachment_contract`,
  `python .\scripts\verify_erp_static.py`,
  `node --check cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`, and
  `git diff --check -- index.html tests/test_reliability_center.py`.
- No deployment was performed.

## C-order Sequence Deploy Gate 2026-08-03

- `index.html` now blocks new C-end order creation and Shopee Excel import when the shared SHPTW sequence state is unavailable.
- The C-order screen shows `C端共用單號尚未連線` with a `重新檢查` action until `/api/corder/number-state` succeeds.
- `submitCorder()` checks `ensureCorderSequenceReady()` before closing the modal or reserving a number for a new order.
- `importShopeeExcel()` checks `ensureCorderSequenceReady()` before batch reservation.
- `reserveCorderNumbers()` also guards itself before calling the sequence-mutating `/api/corder/number-reserve` route.
- Deployment checklist: `CORDER_SEQUENCE_DEPLOY_CHECKLIST.md`.
- Manual GitHub Actions migration entry: `.github/workflows/supabase-corder-sequence.yml` with default dry-run and explicit `apply=true` for the real Supabase write.
- Regression coverage was refreshed in `tests/test_corder_number_sequence.py`.
- Supabase migration was applied from this machine on 2026-08-04 using the existing Supabase pooler connection. Verification returned `SHPTW` with `next_number=16352`.
- GitHub repo secret `SUPABASE_DB_URL` was added on 2026-08-04 so the migration workflow can be reused later.
- Live gate completed: commit `4d9e9c9` deployed through Worker/Pages Actions; production `/api/corder/number-state` returns HTTP 200 with `SHPTW` and `next_number=16352`.
- Follow-up 2026-08-04: the C-order UI now preserves a special-case "set shared next number" action for Vic/manager/sales. It calls `/api/corder/number-set`, only moves the shared next number forward, and localStorage remains a cache of Worker state rather than the source of truth.

## ERP Health v2 / Optimization Queue 2026-08-04

- Current-state entry point: `ERP_CURRENT_STATE.md`.
- ERP Health v2 separates public read-only checks, authorized ERP checks, and manual follow-up items.
- Public health endpoint deployed through Worker route `GET /api/health/public`; production returned HTTP 200, `erp-health-v2`, and C-order `SHPTW next_number=16352` on 2026-08-04.
- Preflight/C-order/BOM/mobile v1 is the active local batch after Health v2. It adds shared `PRE_FLIGHT_CENTER_V1`, C-order Excel preview before sequence reservation, BOM import preview before Supabase write, a simplified BOM template, picking deduction preview, inbound approval preview, and a Health mobile audit panel for orders, Notes, C-order, and inventory adjustment.
- C-order import UX v2 follow-up: the import preview now marks all duplicate Excel rows, separates existing-order rows from rows that will be skipped, blocks missing buyer accounts and non-positive quantities, summarizes per-SKU stock impact, and provides first-error row targeting. Confirmation remains the first `/api/corder/number-reserve` call.
- Optimization order:
  1. Health v2 and current-state cleanup.
  2. Preflight Center for high-risk imports, deductions, approvals, and BOM writes.
  3. C-order import preview and row-level diagnostics.
  4. BOM simplified Excel maintenance and direct-component guard.
  5. Mobile audit for orders, Notes, C-order, and inventory adjustment.

## Live Verification Snapshot 2026-08-03

Status note 2026-08-04: the bullets in this section are historical and superseded by `ERP_CURRENT_STATE.md`. The C-order sequence migration, Worker route, Pages frontend, and Health v2 endpoint are now deployed and verified.

- Local C-order sequence work is present but not verified as deployed.
- Current dirty C-order files to preserve together: `index.html`, `sw.js`, `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`, `supabase/migrations/20260731_015_corder_number_sequence.sql`, and `tests/test_corder_number_sequence.py`.
- Local validation passed on 2026-08-03:
  `python -m unittest tests.test_corder_number_sequence tests.test_corder_primary_contract tests.test_corder_excel_import_contract`,
  `python .\scripts\verify_erp_static.py`, and
  `node --check cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.
- Production Pages check on 2026-08-03 showed `https://lematec-erp.pages.dev/?codex_check=20260803` returned HTTP 200 but did not contain `/api/corder/number-state`; the new frontend is not live there yet.
- Production Worker check on 2026-08-03 showed `https://green-wave-c22f.vic-e93.workers.dev/api/corder/number-state?codex_check=20260803` returned HTTP 500 with `{"error":"Unexpected end of JSON input"}`; this looks like the deployed Worker does not yet contain the new C-order route and is falling through to an older JSON body path.
- This Codex environment has no visible `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `CLOUDFLARE_API_TOKEN`, or local `supabase`/`wrangler` command. Do not claim the migration or deployment is complete from this environment alone.
- Safe next action: apply `supabase/migrations/20260731_015_corder_number_sequence.sql` in Supabase first, deploy the Worker route, verify `/api/corder/number-state` returns the expected state, then deploy Pages/service worker `lematec-erp-v34`. Do not run `/api/corder/number-reserve` against production casually because it advances the shared sequence.

## C-order Primary Database 2026-07-31

- The Notion `C端訂單` database is the only operational destination for new
  C-end/Shopee order imports and manual C-order creation.
- `115年蝦皮訂單` is a legacy archive. The ERP no longer creates rows there,
  updates shipping-label data there, or shows its shortcut in the C-order UI.
- Eight rows that were written only to the legacy database on 2026-07-31 were
  restored to `C端訂單` with status `需確認`. Inventory was not deducted again.
- Cross-device SHPTW number reservation is implemented through the Worker and
  Supabase migration `20260731_015_corder_number_sequence.sql`. The UI no longer
  stores a manually managed starting number. It displays the centrally reserved
  next number; manual and Excel creation reserve numbers atomically, and the
  database allocator calibrates forward against existing Supabase `c_orders`.
  Apply and verify the migration before deploying the new Pages frontend.
- Service worker cache version for this release: `lematec-erp-v34`.

## Notes Reliability And C-order Status 2026-07-30

- C-end recent-order queries now use the actual Notion status values
  `出貨中`, `已完成`, and `已取消`; the invalid legacy query value `取消`
  was removed without changing the regular B2B order status contract.
- Notes write-through failures are persisted in a deduplicated browser retry
  queue. Upserts and deletes retry when connectivity returns, when the app
  returns to the foreground, and after a bounded exponential delay.
- A later successful Notes sync clears matching stale retry work so an older
  payload cannot overwrite a newer Note.
- Health Check now includes Notes read source, Supabase row count, last read
  and sync times, Notion fallback count, pending retries, and retries that
  have failed five or more times.
- Notes itself displays either `同步正常` or the current pending retry count.
- Service worker cache version for this release: `lematec-erp-v31`.
- Validation:
  `python -m unittest tests.test_corder_status_contract
  tests.test_notes_shadow_contract tests.test_verify_erp_static`,
  `python scripts/verify_erp_static.py`, and
  `node --check cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.

## Notes Attachments 2026-07-30

- Formal Notes attachments remain Notion-first even though Notes list and
  calendar reads are now Supabase-primary.
- The Notes form accepts up to 5 arbitrary files per save. Images, video,
  audio, PDF, Office/Excel, archives, and other formats share the same picker.
- Files up to 20MB are uploaded through the Worker to Notion and appended to
  the Note page. Image/video/audio render inline; other files remain download
  links.
- A failed file no longer aborts the other selected files or the Note itself.
  The UI reports uploaded and failed files separately.
- Files over 20MB do not block Note creation. After the Note is saved, the ERP
  offers the original Notion page for manual upload.
- Worker retries Notion 429 and temporary 5xx responses with bounded backoff.
- Service worker cache version for this release: `lematec-erp-v30`.
- Validation:
  `python -m unittest tests.test_notes_attachment_contract
  tests.test_notes_shadow_contract tests.test_verify_erp_static`.

## Notes Completion Status 2026-07-30

- Supabase Notes shadow contains 15 Notes and 46 reply lines.
- Verified date range: 2026-07-01 through 2026-07-29.
- Verified links: customer 4, order 1, material 0.
- Notes list, calendar, reminders, filters, and dashboard counts read Supabase
  first, with an automatic and visible Notion fallback.
- Notes mutations, detail blocks, and attachments remain Notion-first; every
  successful mutation immediately writes through to Supabase.
- Worker accepts both frontend camelCase and database snake_case payload fields.
- Mobile Notes modal no longer scans the inventory list when opened.
- Mobile modal uses native vertical scrolling and keeps the backdrop fixed.
- Service worker cache version for this release: `lematec-erp-v30`.
- Validation:
  `python -m unittest tests.test_notes_shadow_contract tests.test_verify_erp_static`
  and `python scripts/verify_erp_static.py`.
- Runbook: `supabase/NOTES_SHADOW_RUNBOOK.md`.

## Notes Supabase-primary cutover 2026-07-30

- Migration applied: `supabase/migrations/20260730_013_notes_primary_usage.sql`.
- Structured Note mutations now commit through Worker
  `POST /api/notes/write` before any Notion work.
- Notion is a background mirror with local and Supabase reliability queues.
- Normalized tables: `erp_note_replies` and `erp_note_assignments`.
- Mirror state fields on `erp_notes_shadow`: `actual_notion_page_id`,
  `notion_sync_status`, `notion_sync_error`, and `notion_synced_at`.
- Health Check includes Supabase database and Storage usage. Egress remains
  Dashboard-only unless a measured value is supplied to the Worker.
- PWA cache version for this release: `lematec-erp-v32`.
- Required regression command:
  `python -m unittest tests.test_notes_shadow_contract tests.test_notes_attachment_contract tests.test_reliability_center`.

## Notes Migration Status 2026-07-30

- Stage 6 is implemented: Notes list reads are Supabase-primary.
- Notion is the automatic fallback and remains the formal mutation/detail/file
  source in this stage.
- Supabase table: `erp_notes_shadow`.
- Worker routes: `/api/notes/shadow/sync`, `/api/notes/shadow/list`,
  `/api/notes/shadow/summary`, `/api/notes/shadow/delete`.
- Existing Notes backfill is automatic and idempotent when Vic opens Notes.
- Background and user-triggered syncs are serialized so mutations are not
  skipped during a concurrent backup.
- Contract test: `python -m unittest tests.test_notes_shadow_contract`.
- Runbook: `supabase/NOTES_SHADOW_RUNBOOK.md`.

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
7. 若任務與入料、品檢通過、退回、重新提交或入料搬遷有關，讀 `supabase\INBOUND_RUNBOOK.md`。
8. 再讀 `index.html` 的相關函式，依實際程式為準。

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
- 入料歷史資料已在 2026-07-29 搬入 Supabase 並逐筆驗證：1,048 張主單與 1,048 筆明細，缺少 Notion 主單 ID 為 0。
- 入料正式流程已切成 Supabase 主讀寫；建立、退回、重新提交與品檢通過均先寫 Supabase，再更新 Notion 查閱鏡像。
- 品檢通過以 `inbound_qc_pass:<Supabase 入料主單 ID>` 防重，庫存增加使用 Supabase 原子交易；重複點擊、斷線重試或鏡像補同步不得重複入庫。
- 入料的 Notion 備援只允許查閱，不允許退回、重新提交或品檢入庫。
- 44 組歷史重複入料單號依 Notion page ID 分別保留；24 筆無法安全對應料號的舊明細保留為歷史資料，不猜測、不拿來執行新入庫。
- 入料搬遷工具為 `scripts/supabase_inbound_migrate_via_worker.py`；最近通過報表位於 `supabase/inbound_migration_exports/20260729-103648/inbound_migration_report.json`。

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
- `supabase\PICKING_RUNBOOK.md`
- `supabase\INBOUND_RUNBOOK.md`
- `ERP_OPEN_SOURCE_REFERENCES.md`
- `ERP_REGRESSION_CHECKLIST.md`
