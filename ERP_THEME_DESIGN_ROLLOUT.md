# 既有主題逐步落地

## 已認可的方法

先完整介面稿 → 確認造型語言 → 拆透明圖案／角框／伸縮邊條／狀態元件 → 在既有主題完成一個可操作頁面 → 桌面／手機驗收 → 按授權發布／讀回 → 擴展共享元件。不得以換色、淡紋理或獨立圖片框替代整體設計。

Skill：`integrated-ui-theme-design`（本機已安裝，另有完整 ZIP 交接包）；ERP UI 與 taste-design-direction 已加入路由。正式方法來源：[跨產業 UI 美學圖鑑：整體主題化 UI 章節](https://app.notion.com/p/3f9ff6f424bb8186ae9ee1d654a04c5c)。技能格式／封裝檢查不等於其他專案的自動啟動已驗證。

## 第一批：industrial／精密暖灰

- Vic 已認可「精密儀表台」概念稿方向；不新增第二套主題或更改既有 ID。
- 訂單頁垂直切面：透明機械剖面融入標頭、SVG 九宮格角框、刻度分隔、切角控制與橘色選取。圖片保留透明，文字／數值／控制仍是 DOM。
- 角框具明確 SVG 尺寸與固定角區，不讓橘色角標進入可伸縮中段。原錯誤圖框不再出現。焦點改用可見內框，避免被切角裁掉。
- 首批共享框體作用於同主題面板／來源條，未改功能區域、順序、控制尺寸、權限或交易。其他13個主題的 CSS 完全保持。
- 1280×900／390×844：訂單控制資料、順序、尺寸與 V.412 基準相同；無整頁溢出、無 fixture errors。裝飾 pointer-events:none；鍵盤焦點可見；原生停用、勾選及背景開關正常。
- 13項 Python＋16項 Node 檢查及離線 syntax/assets verifier 通過；3個 skin 資產約105KiB。Fixture 以合成資料、CSP 阻擋正式API。正式業務／庫存寫入0。
- 證據：`output/industrial-instrument-stage1-20261104/acceptance.json`；畫面於工作區 `營運管理/outputs/industrial-instrument-stage1-20261104/`。桌面手機為 Chrome viewport，未做實體 iPhone／Safari 或正式交易驗收。

## 第二批：經典深藍／水墨山河（2026-11-04）

- 本次授權：逐步修正其他既有主題，融入底圖／邊框／按鈕，保留架構與操作位置，桌機手機驗收後直接部署，不碰正式庫存。依這次授權完成整頁可檢視實作，再發布；沒有另要求等待新方向確認。
- `tech`「深藍電路控制台」：連續電路走線與節點融入原標頭背板，雙層節點角框、控制面板按鈕、左緣選取定位。`ink`「山水畫框」：山巒／瀑布／遠日背景、雙線畫框、朱色角記與墨綠選取。四個固定尺寸本機 SVG 合計不到 12KB；沒有新增外部服務、動畫或獨立插圖卡。
- 原英雄區裝飾格保留透明占位，只把圖片移到整片背景層，避免改變既有高度及下方操作位置。未重新排列導覽、欄位、按鈕，未改尺寸或字級。背景開關可關閉圖案；框體仍保留辨識；列印移除背景／裝飾框。
- 已實看兩個主題的 1280×900／390×844 訂單、庫存、看板及跨模組元件樣本。訂單控制項名稱／順序／尺寸與原版四組基準逐一相同；兩版無整頁溢出及 fixture errors，框體 pointer-events:none。庫存勾選啟用／取消勾選停用、兩主題焦點及背景關閉正常；缺料樣本保留明確警告。
- 實際 renderer＋合成資料，fixture CSP connect-src/form-action 為 none；未連正式業務 API，正式庫存／業務寫入 0。手機為 Chrome viewport，非實體 Safari；元件樣本不等於完整領料／品管交易驗收。
- 證據：工作區 `營運管理/outputs/theme-round2-integrated-20261104/{geometry,matrix,states}.json` 與四張訂單實作截圖。發布 CSS query v11、SW cache v89；精確正式版本／SHA 以 `output/integrated-theme-round2-20261104/release.json` 為準。
- 其餘 12 個主題不納入本次造型變更；精密暖灰既有成果保留。下一批再個別訂定其他主題的造型語言，不宣稱 14 主題都已重設。

## 水墨重製：雲岫墨卷（2026-11-04）

- Vic 否決上一版幾何山水，已檢視大型國風遊戲介面參考及完整生成稿，並指示照此修正部署。本批只覆寫原 `ink` 主題，保持名稱／儲存 ID、架構、操作次序與尺寸。
- 以認可稿另產原創可用背景（無文字／按鈕），再用 ffmpeg 裁切、縮放與 WebP 壓縮；正式素材為手繪山水 47,714 bytes、紙紋 390 bytes 及固定尺寸雙線角框 SVG。完整稿不是直接切成一張功能頁。來源／尺寸／hash 以 `icons/skins/ink-folio-manifest.json` 為準；生成原稿與 brief 在工作區 `營運管理/outputs/ink-game-reference-20261104/`。
- 山石皴法、松樹、雲霧與瀑布融入整片標頭；窄標頭採遠山頂部裁切，避免每一條都重複瀑布。導航、古金／朱色細框、宣紙按鈕與墨綠選取共同呼應。表格及輸入保持純淺色閱讀面；背景開關可清除身體／標頭／導航圖層；列印關閉裝飾。
- 合成資料的實際訂單／庫存／看板 renderer，以及共享元件樣本，在 1280×900、390×844 各驗收。無整頁溢出或 fixture errors；角框 pointer-events:none。勾選啟用／取消停用、鍵盤焦點、缺料警告與背景開關正常。手機為 Chrome viewport，不代表實體 iPhone／Safari 或正式交易驗收。
- 證據：工作區 `營運管理/outputs/ink-folio-implementation-20261104/`；正式版本／資產讀回見 repo `output/ink-folio-20261104/release.json`。CSS query v12、SW cache v90。未呼叫正式庫存或訂單寫入 API。

## 全主題移除獨立圖格＋框體補齊（2026-11-04）

- Vic 指出 C端訂單的科技青黛仍有「一塊圖片」，要求所有既有主題一併修正，以精密暖灰的整體性為基準，參考不同行業及遊戲。這次直接授權修正發布；未改訂單／庫存權限或交易。
- 從共用 generator 源頭刪除獨立圖格與 210px／106px 保留欄，不只覆蓋單一主題。全部 14 主題的 `.module-brief`／`.analytics-hero` 取消插圖占位，文字用回完整寬度。原導覽／功能／欄位／操作順序保留；裝飾占位移除會縮短部分標頭並上移後續內容，不宣稱絕對 y 座標不變。
- 精密暖灰與原有水墨／經典深藍框體保留。其餘 11 主題各用不同 SVG 原生框體：青黛航太雙定位框、看板訊號機架、企業藍角記、暖白書冊、海藍弧角刻度、紫色軌道雙弧、琥珀黃銅雙框、鈦金斜角、玫瑰菱角、森林葉脈、極簡直線。框體不占位、固定角落比例、pointer-events:none；不新增任何獨立圖片或新主題 ID。
- 手機科技青黛統計卡原左側裝飾 padding 94px、54px 圖示擠壓標題；在原雙欄卡片中改為 62px padding／34px 圖示，6個標題均維持單行；卡片用途與順序保留。
- 參考：正式知識庫「跨產業 UI 美學與參考範本圖鑑」；[IBM Carbon Data Table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) 的表格層次與操作秩序；[teenage engineering OP-1](https://teenage.engineering/products/op-1) 的硬體／儀器精準標示；[Xbox Starfield 官方介面示例](https://news.xbox.com/fr-fr/2023/09/06/debuter-starfield-10-choses-a-savoir-pour-bien-commencer-son-aventure/) 的功能框線與讀數層次。參考是風格轉譯，非照搬原資產／娛樂流程，不聲稱操作過原產品。
- 擴充合成 fixture 加入實際 `renderCorders`，連同訂單／庫存 renderer 與共享元件樣本，14主題 × 桌機1280×900／手機390×844 × 4頁共112組，無整頁溢出、fixture錯誤或圖格。14主題C端勾選→啟用清除→取消停用均通過。手機為Chrome viewport，非實體Safari；元件樣本不是全模組交易驗收。
- 工作區證據：`營運管理/outputs/all-theme-frames-20261104/{matrix,states}.json`、跨頁視覺 contact sheets；明確 C端最終畫面為 `premium-corder-final-desktop.png`／`premium-corder-final-mobile.png`。合成fixture限制connect-src與form-action為none，正式業務寫入0。其他28張為自動巡檢跨頁視覺快照，不逐一標成C端畫面。
- CSS query v13、SW cache v91；正式版本／SHA／38個素材讀回以 repo `output/all-theme-frames-20261104/release.json` 為準。

## 科技青黛深化：深空航控（2026-11-04）

- **持續授權**：Vic 明確指示此類主題視覺升級可完成設計、桌機手機驗收後直接部署，先不逐次詢問。適用於不更動架構、功能位置／順序、資料權威、權限與業務流程的造型／素材變更；不擴大正式庫存操作權限。概念稿不再被當成必須另問一次的批准步驟，仍須做實作及發布驗收。
- 以完整「深空航控」稿深化既有 `premium`／科技青黛，不新增第二個主題。保留14主題無獨立圖格的成果，其他13主題造型不改。
- 素材與構成：認可稿的無字區裁切為256×64金屬材質（656 bytes），原生128×128固定角區SVG面板、48×48控制框；不是把整張稿當功能頁。雙層嵌入框、階梯邊緣、統計讀數模組、導覽／選取控制、暗色輸入槽形成共同語言。手機框邊縮至16px；真實DOM文字／數字／互動保留。
- 驗收發現九宮格斜線跨入可伸縮區，已把斜角限制在固定角區。框體pointer-events:none；切角控制以可見內框顯示鍵盤焦點；原生disabled、勾選／取消、選取列與背景關閉維持。
- 比對方法修正：viewport只作用目前選取分頁，先分別完成舊／新頁尺寸，並在fixture停用進場動畫後比對完成版面，避免把過渡幀或錯尺寸當成產品變動。8組（1280×900／390×844 × C端／訂單／庫存／元件樣本）控制項名稱、順序、x／y、寬高逐項完全相同；無整頁溢出及fixture errors。手機為Chrome viewport；未做實體Safari或正式交易驗收。
- 證據：工作區 `營運管理/outputs/deep-space-implementation-20261104/{geometry,states}.json`、desktop.png、mobile.png；原稿／brief另在 `deep-space-console-concept-20261104/`。合成fixture CSP connect-src／form-action none，正式庫存／業務寫入0。正式版本／SHA／資產讀回見 repo `output/deep-space-20261104/release.json`。
- CSS query v14、SW cache v92。資產manifest及生成一致性納入CI；本批仍不是14主題都完成同等深度的整體重製。

## 後續批次（尚未完成）

1. 精密暖灰其他常用頁面的細節與真實角色唯讀驗收、必要的手機簡化和空／錯誤狀態。
2. 同主題逐項對照認可稿，持續調整圖案、框體、密度；不把第一批共享樣式說成所有模組已逐頁驗收。
3. 其餘既有主題各自提出完整稿，保留各自特色，再逐個實作；不把機械風直接複製到水墨／海洋等主題。

本批發布資產：CSS query v10、SW cache v88。正式成功另以該 commit 的工作流程與正式 HTML/CSS/Worker SHA、28個既有素材和3個新 skin 素材 MIME/hash 讀回確認。
