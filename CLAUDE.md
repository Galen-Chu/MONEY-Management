# CLAUDE.md

MoneyCare · 個人財務統合 App(repo Galen-Chu/MONEY-Management)——記帳為核心,發票/房貸/帳務資料半自動歸集,**金融資料 100% 本機**。Expo SDK 57 + TypeScript strict,沿用 TIME-Management(TimeCare)技術棧與工程模式。P0(骨架+記帳)已於 2026-10-14 完成並收尾歸檔(push `96cb8c9`;verify 33 測全綠、CI 綠燈、expo-doctor 21/21)。

## 常用指令

```bash
npx expo start --web   # web 預覽(InMemory,不持久化)
npx expo start         # Expo Go(native 走 SQLite)
npm run lint           # ESLint(含 JSX 禁寫死 CJK 規則)
npm run typecheck      # tsc --noEmit(strict)
npm test               # Jest(jest-expo + RNTL)
npm run verify         # lint+typecheck+test(同 CI)
```

## 架構

- `src/domain/` — 純函式:`money.ts`(分整數模型+Intl TWD 格式化)、`categories.ts`(固定分類+色票)、`ledger.ts`(Account/Txn 模型、餘額/淨值/月彙總/分類統計/依日分組/現金流/驗證/日期工具)、`loan.ts`(Loan 模型、攤還表/未償本金/額外還本與利率情境試算)、`invoice.ts`(期別數學/獎號模型/九獎項比對/公告頁解析)、`asset.ts`(Asset/估值模型、估值取值/完整淨值/歷史淨值與趨勢)、`csv.ts`(RFC4180 剖析/分隔符嗅探/欄位偵測/列→交易轉換)、`backup.ts`(備份序列化/解析驗證/版本策略)
- `src/data/` — `repository.ts`(介面+InMemory)、`db.native.ts`(expo-sqlite 實作+工廠)、`db.ts`(web InMemory 工廠;Metro 按平台選檔)、`migrations.ts`(介面注入可測;每版一交易+PRAGMA user_version)、`backup.ts`(快照/還原編排)、`backup-io(.native).ts`(平台檔案 IO:web 下載選檔/native 檔案+分享)
- `src/state/` — `ledgerStore.ts`(帳戶/交易 CRUD,guard() 防護:錯誤寫 error 狀態不外拋;web 開發模式暴露 `window.__moneycareStore`)、`loanStore.ts`(貸款 CRUD)、`invoiceStore.ts`(發票 CRUD+獎號快取載入)、`assetStore.ts`(資產 CRUD+估值追加)、`settings.ts`(Zustand+AsyncStorage persist,僅語言)
- `src/app/` — expo-router:`(tabs)/` 七分頁(index=今天、loans=貸款、accounts、stats、invoice=發票、assets=資產、settings);Repository 在 `(tabs)/_layout.tsx` 統一 attach+bootstrap
- `src/components/` — `ui/`(Card/Segmented/BottomSheet/EmptyState/Icon)+ `ledger/`(TxnSheet/TxnRow/AccountSheet/LoanSheet/LoanDetailSheet)+ ErrorBanner
- `src/i18n/` — i18next 單例(zh-TW 預設/en-US 全量;**不跟隨系統**,僅手動切換)+ `format.ts`(Intl 日期/月份)
- `src/theme/tokens.json` — 設計 token 單一事實來源(值同步自 Uniconsign `@galen-chu/uniconsign` 語意層淺色:品牌綠 accent/暖中性階;對應表見 `theme/index.ts` 註解)。字體 Inter(@expo-google-fonts,根布局 `useFonts` 不阻斷渲染;權重映射 500/600/700→medium/semibold/bold,全專案禁用 fontWeight);圖示 vendor 於 `components/ui/icon.tsx`(24×24 填色路徑,color prop 注入)

## 重要行為(修改時勿破壞)

- **金額一律以「分」的整數儲存與運算**(D2):UI 輸入 → `parseAmount` → `toCents`;呈現走 `formatCents`(Intl TWD)。任何新代碼不得以浮點元運算
- **淨值口徑**(D4):餘額=期初+收入−支出+轉入−轉出;信用卡以餘額轉負呈現負債;淨值=Σ正餘額−Σ|負餘額|;**轉帳不計入收支統計**(只是位置移動)
- **分類為固定集**(D3,支出 8+收入 4):label 走 `categories.*` i18n、色票在 `domain/categories.ts`;不做分類 CRUD(變更需同步兩份 locale+parity 測試)
- **驗證單一來源**:交易驗證只走 `domain/ledger.validateTxn`(錯誤碼→`txn.err*` i18n)、貸款驗證只走 `domain/loan.validateLoan`(→`loans.err*`);store 動作重驗一次,UI 不自行發明規則
- **貸款口徑**(P1):年利率以「千分之百分比」整數儲存(2.185%→2185),期內利息=round(剩餘×rateMilliPercent÷1,200,000);annuity 月繳四捨五入為常數、**末期強制結清**(利息逐期捨入殘留);寬限期只繳息;提前還本=月繳不變期數縮短;利率情境=自某期起新利率月繳重算;淨值=帳戶淨值−Σ未償本金
- 刪除帳戶前必查 `accountInUse`(含轉入端引用);被引用 → false + UI 顯示 errInUse
- **金融資料 100% 本機**(D5):不得引入任何雲端/後端儲存;settings 僅存語言
- **備份**(P0.8):匯出=JSON(web 瀏覽器下載/native 寫快取+系統分享,零上傳)涵蓋五表(帳戶/交易/貸款/資產/估值;獎號為公開資料不入檔);還原=**取代**裝置全部資料(兩段式確認);`parseBackup` 做結構驗證,備份版本較新一律拒絕,舊檔缺新欄位→空陣列相容;還原後各 store 重新 bootstrap
- **資產**(P3):估值帶日期,「目前值」=asOf 前最新估值(同日比 createdAt);完整淨值=帳戶淨值+Σ資產估值−貸款未償;歷史淨值依截至日交易+當時估值+當時貸款未償計算
- **CSV 匯入**(P4):限 UTF-8(含 BOM;Big5 需先轉檔);分隔符嗅探(逗號/分號/定位點);欄位自動偵測+人工可調;支出/存入雙欄或正負單欄;西元+民國日期;每筆仍走 `validateTxn` 單一來源驗證,分類預設 other/otherIncome(匯入後可改)
- **發票對獎**(P2):期別=民國年+奇數起始月(11507);獎號來源=稅務入口網公告頁 `ETW183W2_{term}`(唯網路抓取,只抓公開獎號、快取本機 prize_numbers;比對純本機);比對只看後 8 碼、同張多獎項取最高一獎;原始碼 CJK 閘門下解析關鍵字以 `\u` 轉義維持
- **不做網銀爬蟲**(紅線);外部串接前依「串接類開發紀律」查當下官方文件(查證結論與分期見 `docs/PLAN.md`)
- web 走 InMemory 不持久化(native SQLite);web 開發模式有 `window.__moneycareStore` 走查鉤子(僅 NODE_ENV≠production)

## 開發約定(務必遵守)

- **phase-gated**:每階段完成→向使用者展示驗收→核准後才 commit/push(固定 checkpoint)
- **雙語自第一天**:所有字串走 i18n key;ESLint no-restricted-syntax + `no-raw-cjk.test.ts` 掃描雙閘門;金額/日期用 Intl,禁止字串串接
- 溝通語言 zh-Hant;文件風格:emoji 標題+`English · 中文` 雙語段標
- 技術棧(定案,勿擅自更換):Expo dev(現階段 Expo Go+web)、TypeScript strict、Zustand、expo-sqlite、expo-router、i18next、Jest+React Native Testing Library
- 新增純邏輯一律配 Jest 單元測試;repo 類邏輯以介面注入(InMemory)可測;migration 測試斷言交易順序(PRAGMA user_version)
- Windows 環境教訓(沿用 TIME-Management):Jest `testTimeout: 15000`(並行負載逾時 flake);**含中文的 .ps1 一律以 pwsh 7 執行**(WinPS 5.1 誤讀 UTF-8 為 CP950 會靜默漏行);**中文檔案寫入後必掃 U+FFFD、掃淨才 commit**(P0 建案實測 5 處損壞,其中 1 處由測試如實揪出);`formatCents` 勿依賴 Intl 貨幣符號(zh-TW ICU 對本幣 TWD 呈現裸 `$`)

## 待辦排隊(2026-11-24 路線重整·D9 功能優先/D10 功能軸)

- **主線**:P2 現金流管理(餘項)→ P3 資產管理(非帳戶資產+淨值報表深化)→ P4 CSV 匯入 → P5 視資格 → P6 遠期;**環境建置類(深色模式、TestFlight 執行、測試工程、套件依賴化)依 D9 暫緩至功能完成後**
- **待維護者拍板**:P4 載具發票查詢(需營業人統編向財政資訊中心申請 appID——有無統編決定此路開關)
- **優先度較高的工程項**:表單層 RNTL 測試、真機 Expo Go 驗證 SQLite 路徑、TestFlight 首建(卡 Apple Developer 申請)
- 完整清單(產品優化候選+技術債):`docs/PLAN.md` §「待辦與優化清單」
