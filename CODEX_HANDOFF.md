# LEMATEC ERP Codex Handoff

最後更新：2026-07-03

## 專案定位

這是 LEMATEC 目前實際使用中的前端式 ERP。前端部署在 Cloudflare Pages，資料主要透過 Cloudflare Worker proxy 讀寫 Notion。使用者會在電腦、手機瀏覽器、加入主畫面的 PWA 類 App 中操作。

維護時請優先保護既有流程，不要只做語法修正。每次改完都要用業務情境驗證：訂單、庫存、BOM、入料、品管、領料、C 端訂單、記事、手機版。

## 重要路徑

- 專案主資料夾：`C:\Users\vicxd\Documents\Codex\2026-05-21\new-chat\lematec-erp`
- 主檔案：`C:\Users\vicxd\Documents\Codex\2026-05-21\new-chat\lematec-erp\index.html`
- 正式網址：`https://lematec-erp.pages.dev/`
- GitHub repo：`https://github.com/vicxd0728/lematec-erp`
- Cloudflare Pages project：`lematec-erp`
- Worker proxy：`https://green-wave-c22f.vic-e93.workers.dev`
- Worker 程式備份：`cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`
- Workflow：`.github/workflows/cloudflare-pages.yml`

## 部署方式

目前正式流程是：

1. 修改本機專案。
2. 驗證 `index.html` 語法與功能。
3. `git add -- index.html` 或只加入正式修改檔案。
4. `git commit`
5. `git push origin main`
6. GitHub Actions 觸發 `Deploy ERP to Cloudflare Pages`。
7. 檢查 `https://lematec-erp.pages.dev/` 線上版。

注意：GitHub 可能同時出現 `pages build and deployment`。那是 GitHub Pages 內建部署，不是正式 Cloudflare Pages。正式要看 `Deploy ERP to Cloudflare Pages` 是否成功。

## 常用命令

Git：

```powershell
$git='C:\Users\vicxd\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
& $git status --short
& $git log -1 --oneline
```

Node：

```powershell
$node='C:\Users\vicxd\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
```

Python：

```powershell
$py='C:\Users\vicxd\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
```

重要：PowerShell stdin 曾多次造成中文亂碼。寫 Python 腳本時避免直接在 stdin 塞大量中文，或設定：

```powershell
$env:PYTHONIOENCODING='utf-8'
```

若要產生含中文的 JS/JSON，優先使用 `ensure_ascii=True` 或 Unicode escape，最後再用 Node 解析驗證。

## Notion 主要資料庫

程式內 `DB` 目前在 `index.html` 約 1586 行附近。

- ERP 頁面：`b60823b3-452c-467b-a2f9-dc54f3799464`
- 物料主檔：`43d801b4-a787-4101-bd12-d8b8199385c7`
- BOM / 子母件：`6b67dc8d-bafb-49e8-9c39-bf66046a99fe`
- 訂單：`50b7ce68-437e-431f-9a4f-a0d0d65a7b25`
- 領料主檔：`55552dd1-eb31-4d68-8127-63cc062a93f8`
- 領料明細：`267f16cf-e88a-41ed-8049-d39d618a1275`
- 入料：`cff100a4-ddcd-4bda-b8d7-57d44c4b3ce4`
- 國外客戶總檔：`19fff6f4-24bb-80fe-b265-c62fa39c814c`
- 國內訂單同步：`276ff6f4-24bb-807c-bac2-e8c68c788a7e`
- C 端訂單：`64d6326e-c82a-4f5f-bccc-b34833f823c3`
- 115 年蝦皮同步：`276ff6f4-24bb-8024-8a2a-d39aff6800db`
- 蝦皮訂單資料庫：`11b6df09-ee1a-4c56-b235-166bcd250f3a`
- 品管檢驗單：`48f1a7b9-1e89-4f9c-a4db-6df8e5ee7e5f`
- 庫存異動記錄：`0aa78528-a5bb-4a0d-8005-c0c1e0aaf8a3`
- 庫存修改原因記錄：`808d789e-e9d3-4e6d-88d2-d58daa9aba4f`
- 請假：`897e8784-4c2d-452c-a045-c568e175e6d5`
- 登入紀錄：程式會在 ERP 頁面下自動尋找或建立 `ERP 登入紀錄`
- 記事行事曆：程式會在 ERP 頁面下自動尋找或建立 `ERP 記事行事曆`

## 角色權限摘要

角色表在 `index.html` 約 1641 行附近。

- `Vic`：全功能，包含權限設定與健康檢查。
- `廠長`：全主要流程，可介入訂單、生產、品管、庫存等。
- `業務`：訂單、C 端、客戶、庫存查詢與部分庫存調整、請假、記事、影片庫。
- `倉管`：訂單、庫存、領料、入料、生產流程節點、請假、記事、影片庫。
- `品管`：品管、入料瀏覽、請假、記事、影片庫。
- `採購`：兼生管，可看訂單、庫存、領料、入料、排程，並處理生產流程節點。
- `檢視`：只看主要流程，無建立、修改、刪除、審核等操作。

Vic 與廠長有登入密碼。Vic 權限頁可以查看狀態；密碼顯示需注意隱私。

## 核心流程

### 一般國內 / 國外訂單

1. 建立訂單。
2. 產生領料。
3. 領料後扣除 BOM 關聯料件。
4. 狀態進入生產中。
5. 生產中可由倉管、採購、Vic、廠長推到待檢驗。
6. 品管檢驗通過後變待出貨。
7. 待出貨由業務、倉管、Vic、廠長填實際出貨日並完成。

重要 BOM 邏輯：成品若掛半成品，只扣該半成品；不要再展開扣半成品底下零件。成品若同時掛其他零件，仍需扣那些零件。半成品本身應透過半成品組裝單扣零件並增加半成品庫存。

### 蝦皮 S- 訂單

用於製作 C 端可即時出貨的 S- 庫存。

1. 在訂單頁建立蝦皮訂單，選擇 S- 開頭料號。
2. 領料時扣 S- BOM 關聯的普通料件或半成品。
3. 狀態進入生產中。
4. 倉管、採購、Vic、廠長可將 S- 生產中改已完成。
5. 完成時增加 S- 成品庫存。

### C 端訂單

用於直接出貨的消費端訂單。

1. 匯入蝦皮 Excel。
2. 以 `商品選項貨號` 讀 S- 料號。
3. 建立 ERP C 端訂單，並同步到 `115 年蝦皮`。
4. C 端出貨時扣 S- 開頭庫存本身，不應再扣 BOM 子件。
5. SHPTW 編號可在 C 端頁設定起始值。下一張訂單自動遞增。
6. 相同蝦皮單號與買家帳號才共用同一個 SHPTW 內部單號。
7. 出貨中超過 7 天可自動轉已完成。

常見欄位：

- 蝦皮訂單號
- SHPTW 內部訂單號
- 客戶姓名
- 寄件編號
- 商品活動價格作為單價
- 數量
- 總價 = 數量 * 單價
- 物流 / 寄送方式

### 入料與品管

1. 建立入料單。
2. 品管出現入料待品檢。
3. 通過後才真正入庫，入料單狀態應變成品檢通過 / 已入庫。
4. 不合格可退回倉管或供應商，需填原因。
5. 退回後入料單應可重新提交，並允許修改料號、數量、原因。

### 記事

記事是 ERP 共用行事曆與任務紀錄。

目前支援：

- 一般 / 重要 / 緊急
- 指定需知道角色
- 登入提醒
- 我的待辦
- 已讀 / 回覆
- 完成
- 客戶、訂單、料號等 ERP 關聯欄位
- 國外客戶可同步到客戶頁下的記事區

設計原則：

- 單一事件的回覆與更新應往同一頁往下追加，不要建立多個分散頁面。
- 已完成 30 天後可在介面隱藏，但 Notion 後台仍保留。
- 若指定角色已打開記事，可判定已讀並記錄。

### 影片庫

影片庫已匯入 YouTube 全頻道，不分長短影片或直播。

最新驗證：

- 總數：387
- 長影片：227
- Shorts：157
- 直播：3

縮圖由 YouTube ID 產生，若縮圖顯示異常，先檢查影片 URL 是否為 `https://www.youtube.com/watch?v=...`。

## 高風險區

### 1. 運送單解析

曾多次因不同物流版型抓錯收件人或物流來源。不能只針對單一 PDF 修補。

需要多物流樣本一起測：

- 新竹物流
- 蝦皮店到店
- 店到家
- 全家
- 7-ELEVEN
- 萊爾富
- 大榮

判斷原則：

- 優先用檔名判斷物流。
- 檔名不足時再從版型文字判斷。
- 收件人可能是人名、公司名、自訂名稱，不能用固定字數判斷。
- 不要抓寄件人。
- 再次上傳運送單時，應可覆蓋先前錯誤的客戶姓名與寄件編號。

### 2. BOM 與庫存

任何修改 BOM、料號、S- 邏輯都必須模擬：

- 訂單頁一般訂單
- 訂單頁蝦皮 S- 生產單
- C 端 Excel 匯入出貨
- 半成品組裝
- 入料
- 品管通過入庫

### 3. 手機版

手機版曾出現：

- 訂單欄位錯位，交期顯示成數量。
- modal 開啟後滑動卡住。
- 表格左右捲動不易。
- PWA 更新延遲。

每次改 UI 都要手機尺寸檢查，至少看：訂單、C 端、記事、新增記事、請假、品管、庫存。

### 4. Notion 欄位

Notion 欄位改名、select 選項不完整、data source id 錯誤都會造成前端看似成功但後台沒寫入。涉及 Notion 時要確認：

- database id 與 data_source id 是否正確。
- 欄位名稱是否與程式一致。
- select 選項是否存在。
- 寫入後 Notion 實際有資料。

## 部署後驗證

每次 push 後至少做：

```powershell
gh run list --repo vicxd0728/lematec-erp --limit 5
```

確認 `Deploy ERP to Cloudflare Pages` 成功。

再抓線上頁：

```powershell
try { (Invoke-WebRequest -Uri 'https://lematec-erp.pages.dev/' -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $_.Exception.Message }
```

若改影片庫，可用 Node 解析線上 `VIDEO_LIBRARY_SEED` 數量。

## 建議未來補強

- 建立 `ERP_REGRESSION_CHECKLIST.md`
- 建立 `ERP_DATA_SCHEMA.md`
- 建立 `scripts/verify-erp-build.js`
- 建立 `scripts/verify-erp-online.js`
- 建立 `lematec-erp-maintainer` skill
- 運送單解析獨立成測試資料夾與多物流回歸測試

## 維護原則

- 不要改動不相關檔案。
- 不要提交暫存檔、測試 Excel、PDF、臨時 JSON。
- Notion 直接操作前先確認目標資料庫。
- 使用者授權後可以操作 Notion / GitHub，但高風險刪除資料仍需清楚回報。
- 回覆使用者時要說明：改了什麼、驗證了什麼、是否已部署。
