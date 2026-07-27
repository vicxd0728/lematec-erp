# LEMATEC ERP Codex Handoff

最後更新：2026-07-27

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
6. 再讀 `index.html` 的相關函式，依實際程式為準。

不要回復或修改無關的 dirty files。不要印出 token、DB URL、Cloudflare token、Notion token。

## 目前資料主從

詳細規則在 `ERP_DATA_FLOW.md`。簡版如下：

- Notion 仍是大多數正式操作資料源與人員查閱後台。
- Supabase 已開始承接速度敏感資料，但採漸進式切換。
- 庫存頁可切換「Notion 正式 / Supabase 優先」。Supabase 優先需要本機已設定 anon public key，且目前只影響庫存頁顯示與搜尋。
- 庫存新增與庫存數量修改目前仍先以 Notion 正式流程為主，但前端會自動排入 Supabase 鏡像佇列；刪除、訂單扣料、BOM 寫入仍未正式切 Supabase。
- 異動紀錄正在轉向 Supabase 主讀寫，Notion 需同步保留鏡像，供人員查閱。
- 影片庫優先讀 Supabase，失敗時退回備援清單。

## Supabase Key 行為

前端使用的是 Supabase anon public key，存在瀏覽器 `localStorage` 的 `lematec_supabase_anon_key`。

- 沒有 key：不會讀 Supabase 庫存快照，庫存頁回到 Notion 正式資料。
- 有 key：庫存頁預設可使用 Supabase 優先，但只讀；修改類操作仍需切回 Notion 正式。
- 異動紀錄有 key 時會先讀 Supabase，失敗再退回 Notion。
- 前端不可使用 PostgreSQL DB URL 或 postgres 密碼。
- 前端庫存鏡像不靠 anon key 寫入；它會呼叫 Worker `/api/inventory/sync`，由 Worker 內部的 `SUPABASE_SERVICE_ROLE_KEY` 寫入 Supabase。

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
