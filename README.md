# LEMATEC ERP

本儲存庫包含既有 LEMATEC ERP 網頁與 Cloudflare Worker。正式前端來源是部署到 Cloudflare Pages 的 `index.html`；Worker 來源是 `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`。`erp-action-receipts.js` 是第一個抽出的瀏覽器模組，只保存本機操作參照，不是業務主資料。

## 目前資料權責

| 範圍 | 正式資料 | 次要介面 |
| --- | --- | --- |
| 庫存、BOM、正式異動、領料、入料／品檢、記事結構資料 | 經 Worker 寫入 Supabase | Notion 人員可讀鏡像或明確標示的唯讀備援 |
| 一般／C 端訂單、客戶、請假、行銷行程 | Notion | ERP 畫面與操作流程 |
| 記事附件與內文區塊 | Notion | ERP 記事畫面 |

修改寫入流程前，先讀 [ERP_DATA_FLOW.md](ERP_DATA_FLOW.md) 與 [ERP_CURRENT_STATE.md](ERP_CURRENT_STATE.md)。Notion 鏡像失敗不可重做已接受的庫存交易。部署或本機測試成功，不等於員工已完成實際操作驗收。

## 本機檢查與部署

執行 `python scripts/verify_erp_static.py` 與相關流程的測試。Worker 變更另需執行 `node --check cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`。[Worker 工作流程](.github/workflows/cloudflare-worker.yml)與 [Pages 工作流程](.github/workflows/cloudflare-pages.yml)從 `main` 部署；Pages 會等待相同 commit 的 Worker 成功，並把 `V.LOCAL` 換成正式版本。部署後須讀回 Worker SHA、Pages 版本與無快取的正式檔案。

[每日資料品質工作流程](.github/workflows/erp-daily-quality.yml)只讀檢查。鏡像差異是原始比對，可能包含尚在排隊的同步工作；排程不會修復庫存、訂單、品檢或鏡像。

不得把整合 Token、service-role key、資料庫網址或其他憑證寫入儲存庫、Issue 或報告。員工登入仍沿用公司 Token＋角色；部署密鑰在原始碼之外設定。

操作細節見 [CODEX_HANDOFF.md](CODEX_HANDOFF.md)、[異動紀錄手冊](supabase/STOCK_LOG_RUNBOOK.md)、[領料手冊](supabase/PICKING_RUNBOOK.md)與[入料手冊](supabase/INBOUND_RUNBOOK.md)。
