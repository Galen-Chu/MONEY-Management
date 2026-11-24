# 💰 MoneyCare · 產品計畫(P-PLAN)

> 個人財務統合 App(Invoice/ Mortgage/ 消費/ 信用卡/ 帳務/ 資產)——「半自動歸集 + 本機優先」路線。
> repo:Galen-Chu/MONEY-Management;對照家族:TEXT-Message(文管庫)/ MEDIA-Message(媒管庫)/ TIME-Management(TimeCare)。

---

## 🧭 定位 · Positioning

維護者自用的**單一介面財務總覽**:記帳為核心,發票/房貸/帳務資料以「可行的管道」半自動歸集,所有資料 100% 留在裝置上。不追求全自動串接(台灣現況不可行),追求「一目瞭然 + 低摩擦輸入」。

核心使用循環:**記一筆 / 歸集 → 帳戶淨值 → 月度統計 → 分類洞察**。

---

## 🔍 串接查證結論(2026-10 查證;動手前依串接紀律重查當下文件)

| 資料源 | 可行性 | 管道 |
|---|---|---|
| 銀行交易/餘額 | ❌ 正式 API 個人拿不到 | Open Banking 第三階段雖開放申請,但 TSP 認證為企業級;替代=網銀 CSV/明細匯出匯入(P3) |
| 信用卡帳單 | ❌ 同上 | 電子帳單匯入 / 帳務郵件解析(P5) |
| 載具發票明細 | ⚠️ 有門檻 | 財政部「電子發票應用 API」——需以**營業人身分**向財政資訊中心申請 appID+金鑰(個人名義空間極小);替代=綠界等加值中心 API(商戶導向) |
| 發票對獎號碼 | ✅ 完全開放 | 政府開放資料(data.gov.tw,JSON/CSV,CC BY 4.0)+ invoice.etax.nat.gov.tw 每期公告 |
| 貸款試算 | ✅ 零串接 | 純計算(攤還表/提前還款/利率情境;房貸/車貸/信貸通用) |

**紅線:不做網銀爬蟲**(違反銀行服務條款+資安風險)。

---

## 📐 決策記錄 · Decisions

| # | 決策 | 內容 |
|---|---|---|
| D1 | 技術棧 | Expo SDK 57 + TypeScript strict——沿用 TIME-Management(TimeCare)全套模式(expo-router/Zustand/expo-sqlite/i18next/Jest+RNTL),經驗直接轉移 |
| D2 | 金額模型 | 一律以「分」的整數儲存與運算(避免浮點誤差);呈現才以 Intl TWD 格式化 |
| D3 | 分類 | P0 固定分類集(支出 8+收入 4),不做 CRUD;label 走 i18n、色票集中 domain/categories |
| D4 | 帳戶模型 | 單一餘額:期初+收入−支出+轉入−轉出;信用卡以「餘額轉負」呈現負債,淨值=Σ正餘額−Σ\|負餘額\| |
| D5 | 隱私 | 金融資料 100% 本機(SQLite/InMemory),零後端零雲端;settings 僅存語言 |
| D6 | 平台 | P0 以 Expo Go + web 預覽開發;dev client(prebuild)留待需要背景通知/載具查詢時(同 TimeCare 教訓:屆時記得 expo-constants) |
| D7 | 設計系統 | 介面改以 **Uniconsign**(`@galen-chu/uniconsign`,維護者自有設計系統)為單一來源:`tokens.json` 內嵌其語意層淺色值(品牌綠 accent/暖中性階/青黃輔色);深色模式、Inter 字體、圖示匯入為後續工程項 |
| D8 | iOS 發佈 | 自用走 **TestFlight**:Apple Developer 個人帳號(年費 US$99)+ Expo 雲端建置(Windows 無法本機建 iOS,免費額度每月 15 次);build 90 天效期需每季重建 |

---

## 🚀 分期 · Phases

| 期 | 內容 | 狀態 |
|---|---|---|
| **P0** | 骨架 + 記帳:四分頁(今天/帳戶/統計/設定)、帳戶 CRUD、交易 CRUD(支出/收入/轉帳)、月度統計、分類分佈、淨值卡、雙語、CI | ✅ 2026-10-14 |
| **P0.6** | UI 改版(Uniconsign):批次一 ✅ token 遷移語意層淺色值+硬編碼色清零(2026-11-24);批次二 ✅ Inter 字體(400–700,權重映射)+ Uniconsign 圖示系統(tab 五圖示/箭頭/關閉/加號,vendor 於 `ui/icon.tsx`)(2026-11-24);餘:深色模式 | 🔄 深色模式待做 |
| **P0.7** | iOS 發佈管線:`eas.json`(production/simulator)、圖示與 splash 品牌換膚、發佈手冊 `docs/RELEASE.md` 備妥;**待維護者:Apple Developer 申請 + `eas login` 後執行首次雲端建置**(步驟見 RELEASE.md) | 🔄 管線備妥 |
| **P0.8** | 資料匯出備份:JSON 匯出(web 下載/native 系統分享)+ 還原(兩段式確認、結構驗證、版本策略向前不相容拒絕) | ✅ 2026-11-24 |
| P1 | 淨值報表深化 + 貸款模組(房貸/車貸/信貸通用:攤還表、提前還款、利率情境——純計算) | 🔄 貸款模組 ✅ 2026-11-24;淨值報表深化待開工 |
| P2 | 發票對獎(開放資料;號碼管理+自動比對中獎) | 待開工 |
| P3 | 銀行/信用卡 CSV 匯入(各家格式映射) | 待開工 |
| P4 | 載具發票查詢(視營業人資格申請 appID;維護者決策) | 視資格 |
| P5 | 帳務郵件解析(唯讀、建議層——鏡像文管庫 Gmail 模組經驗) | 遠期 |

---

## 🧪 驗收基準 · P1 貸款模組(2026-11-24 達成)

- 貸款 CRUD:五類型(房/車/信/學/他)、本息/本金攤還、寬限期;驗證單一來源 `domain/loan.validateLoan`
- 攤還表:golden 值鎖定(100 萬/2%/240 期 → 月繳 5,058.83)、末期強制結清零殘留、寬限期只繳息、零利率邊界
- 試算:額外還本(月繳不變期數縮短+利息節省)、利率情境(自某期起新利率,月繳重算總期數不變)
- 淨值整合(D4 擴充):淨值 = 帳戶淨值 − Σ未償貸款本金,帳戶頁負債含貸款並顯示提示
- 分頁:五分頁(今天/貸款/帳戶/統計/設定);詳情 Sheet 含未來 12 期攤還+雙試算
- 品質:`npm run verify` 全綠(57 測,新增 24);migration v3(loans 表)測試含交易順序斷言

---

## 🧪 驗收基準 · P0(2026-10-14 達成,收尾歸檔)

- 帳戶:新增/編輯/刪除(引用中擋刪);淨值=資產−負債
- 交易:三類型 CRUD;驗證(金額>0、日期合法、分類必填、轉帳雙戶不同)
- 統計:月導覽、收支淨三卡、分類分佈長條(轉帳不計)
- 品質:`npm run verify` 全綠(lint 含 CJK 規則 / tsc strict / Jest 33 測);CI 綠燈;expo-doctor 21/21

---

## 🗂️ 待辦與優化清單(2026-10-14 P0 收尾歸檔盤點)

### 主線開發(依分期,維護者排程)

1. **P0.6 UI 改版(Uniconsign)**——token 遷移(進行中);後續批次:Inter 字體、圖示匯入、深色模式
2. **P0.7 iOS 發佈管線**——eas.json/splash 對齊/TestFlight 上架(卡 Apple Developer 申請:維護者動作)
3. **P1 貸款模組**——✅ 2026-11-24 完成待收尾 commit;餘項:淨值報表深化
4. **P2 發票對獎**——政府開放資料(號碼來源+中獎比對)
5. **P3 CSV 匯入**——銀行/信用卡明細格式映射(各家檔案下載樣本先行)
6. **P4 載具發票查詢**——**待維護者拍板:是否有營業人(統編)資格申請財政資訊中心 appID**
7. **P5 帳務郵件解析**——唯讀、建議層(鏡像文管庫 Gmail 模組經驗)

### 產品優化候選(P0 實際使用後按需求挑選)

| 項目 | 說明 | 備註 |
|---|---|---|
| 交易歷史瀏覽 | 今天頁目前僅顯示當月;加月份導覽或歷史捲動 | 統計頁月導覽元件可沿用 |
| 帳戶交易過濾 | 點帳戶卡看該帳戶交易明細 | |
| 資料匯出備份 | ✅ 2026-11-24 完成(P0.8):JSON 匯出+還原,見分期表 | 後續可加:自動提醒、CSV 格式 |
| 定期交易 | 房租/訂閱到期自動產生「草稿」交易 | 沿用家族「必經確認」慣例——不自動入帳 |
| 分類月預算 | 各分類預算上限+接近警示 | |
| 備註搜尋 | 交易關鍵字搜尋/篩選 | |
| 自訂分類 | 開放分類 CRUD | D3 原刻意固定;需 schema 遷移+雙語對稱處理,遠期 |

### 技術債/工程優化

| 項目 | 說明 | 備註 |
|---|---|---|
| 表單層測試 | TxnSheet/AccountSheet RNTL:類型切換/驗證訊息/轉帳雙戶分支 | P0 僅 TxnRow 有元件測試 |
| 畫面層測試 | 四分頁 RNTL:空狀態/摘要卡/月導覽 | |
| 真機驗證 | Expo Go 實測 native SQLite 路徑(SQLite repo 僅單元覆蓋,migration/CRUD 未真機跑過) | 比照 TIME 的 dev client 待辦模式 |
| web 走查腳本 | Selenium 腳本(比照 TIME `scripts/*-walkthrough.py`;`window.__moneycareStore` 鉤子已備) | |
| web 資料持久化 | InMemory→IndexedDB(若 web 成為正式交付目標) | 現況已知限制,同 TIME |
| SDK 58 升級批 | expo 58 轉正後一次升級(比照 TIME 依賴保鮮流程:改範圍+全新解析) | 58 目前仍在 next |
| CI 基礎設施 | actions 版本/node 版本追蹤 | 借鏡 TIME:ubuntu-latest 映象遷移期 |
| a11y 深化 | 對比度檢核腳本(TIME 有 contrast-audit 可鏡像)、動態字型複查 | |
| Uniconsign 深色模式 | 成對深色 token(語意層已附 `$extensions.mode.dark`)+ `userInterfaceStyle` 切換 | D7 後續批次;元件雙模式複查 |
| 圖示擴編 | `ui/icon.tsx` 目前 vendor 9 枚;依需求自 `@galen-chu/uniconsign` 增補(分類點、交易列轉帳符號) | 圖示集 241 枚 |
| 設計系統套件依賴化 | `tokens.json`/`icon.tsx` 手動同步 → npm 依賴 `@galen-chu/uniconsign` | GitHub Packages 需 PAT(read:packages)+ CI secret |
