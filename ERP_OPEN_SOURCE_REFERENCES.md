# LEMATEC ERP Open Source Reference Map

最後更新：2026-07-11

## 使用目的

這份文件不是要把 LEMATEC ERP 改成另一套開源 ERP，而是把可借鏡的 GitHub / 開源系統做成參考地圖。未來遇到權限、BOM、庫存、記事、行動版、效能或資料同步問題時，先看這份文件，確認「可以借哪個做法」與「不要照搬什麼」。

目前 LEMATEC ERP 的主系統仍維持：

- 前端：單頁 `index.html`
- 部署：GitHub -> Cloudflare Pages
- 資料：Notion + Cloudflare Worker proxy
- 目標：快速穩定支援現場作業，不追求大型 ERP 架構完整度

## 參考原則

1. 只借流程與設計模式，不直接搬大型系統。
2. 每次只針對一個痛點參考 1 到 3 個 repo。
3. 先寫出「借用概念」再改程式。
4. 不增加不必要的大型前端框架或後端服務。
5. Notion 仍是目前資料源，除非明確啟動 Supabase / PostgreSQL 遷移。
6. 任何借鏡都要符合現有角色、BOM、S-蝦皮、C端、入料、品管流程。

## 參考地圖

| ERP 痛點 | 優先參考 | 可借用概念 | 不採用 |
|---|---|---|---|
| 訂單狀態流轉 | ERPNext / Odoo | 狀態機、角色可執行動作、流程鎖定 | 不搬整套 Python / Odoo 後端 |
| 權限管理 | ERPNext / Odoo | 角色矩陣、依角色顯示頁面、依角色限制動作 | 不只靠前端隱藏按鈕作為長期安全方案 |
| 庫存異動 | ERPNext Stock Ledger / Odoo Inventory | 所有加減庫存都形成不可逆異動紀錄 | 不做複雜會計成本與估價 |
| BOM / 製造 | ERPNext Manufacturing / Odoo MRP | BOM 直接子件、製令、領料、完工入庫 | 不自動展開半成品到底層零件 |
| 入料與品管 | ERPNext Quality Inspection | 待檢、通過入庫、退回、原因紀錄 | 不讓入料直接入庫 |
| 記事與待辦 | Plane / GitHub Issues | 指派、留言串、已讀、待我處理、完成封存 | 不做完整專案管理系統 |
| 行事曆與提醒 | Plane / GitHub Issues / Calendar apps | 到期日、提醒日、重要程度、角色通知 | 不做複雜排程衝突管理 |
| 行動版 PWA | PWA sample projects | 更新提示、快取策略、可滑動 modal、避免誤關 | 不離線處理所有 ERP 操作 |
| 資料表與後台 | NocoDB / Baserow 類工具 | 表格視角、篩選、欄位治理、資料字典概念 | 不把 Notion 立刻替換掉 |
| OCR / 運送單解析 | pdf.js / barcode / OCR pipelines | 先 PDF 文字層、再模板規則、最後 OCR fallback | 不只用通用 OCR 猜收件人 |
| 效能 | Dashboard / CRM 類專案 | 首屏優先、近 30 天預載、搜尋再全查、快取 | 不一次抓全部歷史資料 |

## 已驗證可參考的開源方向

### ERPNext / Frappe

GitHub：`frappe/erpnext`

適合借：

- 訂單、採購、庫存、製造、品管的流程分層。
- 角色與流程權限的思路。
- Stock Ledger 形式的庫存異動紀錄。
- Manufacturing / BOM / Work Order 的設計語言。

不適合現在做：

- 不建議把 ERPNext 當主系統導入。
- 不建議現在改用 Frappe 後端。
- 不建議一次引入會計、成本、薪資等大模組。

### Odoo

GitHub：`odoo/odoo`

適合借：

- Inventory / Manufacturing / Quality 的角色分工。
- 流程狀態、按鈕權限、動作記錄。
- 每個業務單據都有 chatter / message log 的概念。

不適合現在做：

- 不導入 Odoo 模組架構。
- 不照搬 Odoo UI，因為 LEMATEC ERP 需要更輕、更快、手機友善。

### Plane

GitHub：`makeplane/plane`

適合借：

- 記事 / 任務的「指派、回覆、狀態、優先級」。
- 我的待辦、未讀、已完成封存。
- 留言串與事件活動紀錄。

不適合現在做：

- 不做 sprint、roadmap、issue cycle。
- 不把 ERP 記事變成完整專案管理工具。

### NocoDB / Baserow 類資料表工具

適合借：

- 資料表欄位治理。
- 檢視、篩選、排序、欄位說明。
- 低門檻後台資料維護概念。

注意：

- 只借 UI / 資料治理概念。
- Notion 目前仍是後台，不要因為參考這類工具就急著遷移。

## LEMATEC ERP 專用應用方式

### 1. 權限與流程

未來遇到「誰可以按這個按鈕」時，用這個格式設計：

```text
狀態：生產中
動作：送品管 / 完成 S- 入庫
允許角色：倉管、採購、Vic、廠長
禁止角色：業務、品管、檢視
紀錄：異動記錄 + 操作人角色
```

### 2. 庫存與 BOM

採 ERPNext / Odoo 的「異動紀錄優先」概念：

- 只要改庫存，一定寫異動紀錄。
- C端出貨扣 S- 成品庫存本身。
- 訂單頁蝦皮 S- 生產領料扣 S- BOM 直接子件。
- S- 生產完成才增加 S- 成品庫存。
- 成品 BOM 掛半成品時只扣半成品，不展開半成品底下零件。
- 半成品組裝單才扣零件並增加半成品庫存。

### 3. 記事與待辦

採 Plane / GitHub Issues 的輕量做法：

- 一件記事就是一個主事件。
- 回覆往同一事件下方追加，不另外建立新事件。
- 指定角色打開後記已讀。
- 有新回覆時，指定角色重新進入待辦。
- 發布者與 Vic 可完成；被指定者可回覆。
- 已完成超過 30 天後前台預設隱藏，Notion 保留。

### 4. 運送單解析

採 pipeline 設計，不用單一猜測：

```text
檔名判斷物流
-> PDF 文字層擷取
-> 物流模板解析
-> QR / 條碼輔助
-> 信心分數與人工確認
-> 寫回 ERP C端與 115年蝦皮
```

運送單解析不應只為單一檔案硬修。每次修改後至少回歸：

- 新竹
- 蝦皮店到店
- 店到家
- 全家
- 7-ELEVEN
- 萊爾富
- 大榮

### 5. 首屏速度

採 dashboard 的首屏策略：

- 首次只載入角色最需要的資料。
- C端、異動紀錄、記事預設只抓近 30 天 / 未完成 / 待處理。
- 搜尋或按「載入全部歷史」才抓完整資料。
- 庫存目前不先限制，避免倉庫查料出錯。
- Worker 可加短快取降低 Notion 壓力，但寫入資料後需避免讀到舊資料。

## 未來可建立的專用 skill

建議之後建立 `lematec-erp-maintainer` skill，內容包含：

- 專案路徑與部署流程。
- Notion DB 對照表。
- 角色權限。
- 訂單 / C端 / S-蝦皮 / BOM / 入料 / 品管流程。
- 手機版檢查清單。
- 運送單解析回歸清單。
- 速度優化準則。
- 高風險操作提醒。

這個 skill 比繼續找更多 GitHub repo 更重要，因為它能讓每次 AI 接手時先理解 LEMATEC ERP 的真實規則。

## 每次借鏡開源前的提問

未來如果要參考開源，先回答：

1. 這次要解決哪個 ERP 痛點？
2. 這個痛點是流程、UI、資料、速度、權限還是部署？
3. 有沒有現有 LEMATEC 規則不能破壞？
4. 開源專案只借哪一個做法？
5. 如何用現有 `index.html + Notion + Worker` 做最小落地？
6. 要怎麼驗證沒有破壞 C端、BOM、入料、品管、手機版？

## 參考來源

已於 2026-07-11 查驗過以下 GitHub 主來源：

- `frappe/erpnext`
- `odoo/odoo`
- `makeplane/plane`
- `nocodb/nocodb`

這些專案只作為流程與設計參考；LEMATEC ERP 仍以本專案的 `CODEX_HANDOFF.md` 與現有 Notion 資料庫為準。
