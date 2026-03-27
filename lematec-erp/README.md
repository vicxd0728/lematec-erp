# LEMATEC ERP 系統

製造業 ERP 系統，前端搭配 Notion 資料庫。

## 部署方式（GitHub + Netlify）

### Step 1 — 上傳到 GitHub

1. 前往 [github.com](https://github.com) 建立帳號（免費）
2. 點右上角「+」→「New repository」
3. 名稱填：`lematec-erp`，設定為 **Public**，點「Create repository」
4. 把這個資料夾的所有檔案上傳：
   - 點「uploading an existing file」
   - 把整個資料夾拖進去（包含 `netlify/` 子資料夾）
   - 點「Commit changes」

### Step 2 — 部署到 Netlify

1. 前往 [netlify.com](https://netlify.com) 用 GitHub 帳號登入
2. 點「Add new site」→「Import an existing project」
3. 選「Deploy with GitHub」→ 選剛才建的 `lematec-erp`
4. 設定保持預設 → 點「Deploy site」
5. 等 1-2 分鐘後會得到網址，例如：`https://lematec-erp.netlify.app`

### Step 3 — 取得 Notion Token

1. 前往 [notion.so/profile/integrations](https://notion.so/profile/integrations)
2. 點「New integration」→ 名稱填「LEMATEC ERP」→ 儲存
3. 複製「Internal Integration Secret」（`ntn_` 開頭）
4. 在 Notion 打開「工廠 ERP」主頁 → 右上角「⋯」→「Connect to」→ 選「LEMATEC ERP」

### Step 4 — 使用系統

開啟你的 Netlify 網址，輸入 Notion Token，選角色，進入系統。

## 檔案結構

```
lematec-erp/
├── index.html                    # 主網頁
├── netlify.toml                  # Netlify 設定
├── netlify/
│   └── functions/
│       └── notion.js             # Notion API Proxy（解決 CORS）
└── README.md
```

## 角色說明

| 角色 | 功能 |
|------|------|
| 廠長 | 全部功能 |
| 業務 | 建立訂單、客戶管理 |
| 生管 | 產出領料單、自動扣料 |
| 倉管 | 庫存查詢、入料登錄 |
| 品管 | 品檢確認、自動入庫 |
| 採購 | 庫存警示、入料登錄 |
