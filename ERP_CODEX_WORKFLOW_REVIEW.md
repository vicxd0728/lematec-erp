# LEMATEC ERP Codex Workflow Review

更新日：2026-07-03

## 結論

近期 ERP 優化已經出現高度重複的工程模式，建議建立 1 個核心 skill、3 份專案 md、2 組固定驗證腳本。先建立 md 與腳本，再把穩定流程沉澱成 skill，避免 skill 過早變成雜訊。

## 建議建立的 Skill

### lematec-erp-maintainer

用途：每次處理 LEMATEC ERP 功能修改、Notion 結構更新、Cloudflare/GitHub 部署、手機版檢查、資料同步邏輯時使用。

應包含：

- 專案位置：`C:\Users\vicxd\Documents\Codex\2026-05-21\new-chat\lematec-erp`
- 正式網址：`https://lematec-erp.pages.dev/`
- GitHub repo：`vicxd0728/lematec-erp`
- 常用流程：修改前讀 `index.html`、只提交正式檔案、推 GitHub 後驗證 Cloudflare Pages。
- 高風險區：C 端訂單、BOM、庫存扣料、Notion 欄位、手機版 UI、運送單解析。
- 驗證要求：每次改邏輯後必須做情境模擬，不只語法檢查。

不建議拆成太多 skill。ERP 是同一套系統，拆太細會讓上下文斷裂。若後續真的要拆，最多拆成：

- `lematec-erp-notion-sync`
- `lematec-erp-mobile-ui`
- `lematec-erp-shopee-corder`

## 建議建立的專案 Markdown

### CODEX_HANDOFF.md

目的：讓任何新對話都能快速接上，不用重新解釋 ERP 架構。

內容應包含：

- 專案路徑、部署網址、GitHub repo
- Notion 主要資料庫與用途
- 角色權限摘要
- C 端訂單、一般訂單、入料、品管、領料、記事、影片庫流程
- 目前已知風險與待驗證清單

### ERP_REGRESSION_CHECKLIST.md

目的：每次部署前固定檢查，避免修 A 壞 B。

必測項目：

- 新增國內/國外/蝦皮訂單
- C 端 Excel 匯入與 SHPTW 編號
- S- 料號扣庫存與 BOM 關聯
- 入料單送品管、退回、重新提交、入庫
- 品管檢驗單與照片
- 記事指定角色、已讀、回覆、完成、Notion 同步
- 手機版訂單、C 端、記事、請假畫面
- 影片庫縮圖、搜尋、複製連結
- Cloudflare Pages 線上版是否為最新

### ERP_DATA_SCHEMA.md

目的：記錄 Notion 欄位與前端欄位對照，降低欄位改名或新增欄位造成的錯誤。

優先記錄：

- 物料主檔
- BOM / 子母件
- C 端訂單
- 115 年蝦皮
- 訂單
- 入料
- 品管
- 記事
- 登入紀錄

## 建議建立的固定腳本

### verify-erp-build.js

每次部署前執行：

- 檢查 `index.html` 內嵌 script 語法
- 檢查重要常數是否存在
- 檢查影片庫數量、YouTube 連結、縮圖 ID
- 檢查是否含 `???` 亂碼

### verify-erp-online.js

每次 push 後執行：

- 抓取 `https://lematec-erp.pages.dev/`
- 確認線上版包含最新功能關鍵字
- 確認影片庫、PWA manifest、sw.js 可讀
- 回報 GitHub Actions 中 Cloudflare workflow 是否成功

## 近期工程覆盤

### 需要沉澱的原因

- 蝦皮、C 端、BOM、Notion 欄位多次出現「邏輯理解正確，但實作路徑容易偏」。
- 手機版與桌機版常因同一資料用不同渲染方式而出錯。
- 運送單解析需要模板、回歸檔與多物流測試，不適合每次臨場修。
- 部署已改成 GitHub + Cloudflare，自動化成功，但 GitHub Pages 的失敗通知容易混淆。
- Notion 欄位與資料庫越來越多，需要 schema 文件當作真相來源。

### 不建議放進 skill 的內容

- 大量 Notion 連結清單：放在 `ERP_DATA_SCHEMA.md`，skill 只提示要讀。
- 每次 UI 細節審美：放在設計檢查表，不要塞進 skill。
- 一次性的錯誤修正紀錄：放 Git commit 或 issue，不要塞進 skill。

## 建議下一步

1. 先建立 `CODEX_HANDOFF.md`。
2. 再建立 `ERP_REGRESSION_CHECKLIST.md` 與 `ERP_DATA_SCHEMA.md`。
3. 把穩定後的操作流程做成 `lematec-erp-maintainer` skill。
4. 把運送單解析與 C 端訂單建立獨立測試資料夾，之後每次修改都跑固定案例。
