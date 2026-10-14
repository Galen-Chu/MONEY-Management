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

- `src/domain/` — 純函式:`money.ts`(分整數模型+Intl TWD 格式化)、`categories.ts`(固定分類+色票)、`ledger.ts`(Account/Txn 模型、餘額/淨值/月彙總/分類統計/依日分組/驗證/日期工具)
- `src/data/` — `repository.ts`(介面+InMemory)、`db.native.ts`(expo-sqlite 實作+工廠)、`db.ts`(web InMemory 工廠;Metro 按平台選檔)、`migrations.ts`(介面注入可測;每版一交易+PRAGMA user_version)
- `src/state/` — `ledgerStore.ts`(帳戶/交易 CRUD,guard() 防護:錯誤寫 error 狀態不外拋;web 開發模式暴露 `window.__moneycareStore`)、`settings.ts`(Zustand+AsyncStorage persist,僅語言)
- `src/app/` — expo-router:`(tabs)/` 四分頁(index=今天、accounts、stats、settings);Repository 在 `(tabs)/_layout.tsx` 統一 attach+bootstrap
- `src/components/` — `ui/`(Card/Segmented/BottomSheet/EmptyState)+ `ledger/`(TxnSheet/TxnRow/AccountSheet)+ ErrorBanner
- `src/i18n/` — i18next 單例(zh-TW 預設/en-US 全量;**不跟隨系統**,僅手動切換)+ `format.ts`(Intl 日期/月份)
- `src/theme/tokens.json` — 設計 token 單一事實來源(暖紙底/墨棕/松綠 accent)

## 重要行為(修改時勿破壞)

- **金額一律以「分」的整數儲存與運算**(D2):UI 輸入 → `parseAmount` → `toCents`;呈現走 `formatCents`(Intl TWD)。任何新代碼不得以浮點元運算
- **淨值口徑**(D4):餘額=期初+收入−支出+轉入−轉出;信用卡以餘額轉負呈現負債;淨值=Σ正餘額−Σ|負餘額|;**轉帳不計入收支統計**(只是位置移動)
- **分類為固定集**(D3,支出 8+收入 4):label 走 `categories.*` i18n、色票在 `domain/categories.ts`;不做分類 CRUD(變更需同步兩份 locale+parity 測試)
- **驗證單一來源**:交易驗證只走 `domain/ledger.validateTxn`(錯誤碼→`txn.err*` i18n);store 動作重驗一次,UI 不自行發明規則
- 刪除帳戶前必查 `accountInUse`(含轉入端引用);被引用 → false + UI 顯示 errInUse
- **金融資料 100% 本機**(D5):不得引入任何雲端/後端儲存;settings 僅存語言
- **不做網銀爬蟲**(紅線);外部串接前依「串接類開發紀律」查當下官方文件(查證結論與分期見 `docs/PLAN.md`)
- web 走 InMemory 不持久化(native SQLite);web 開發模式有 `window.__moneycareStore` 走查鉤子(僅 NODE_ENV≠production)

## 開發約定(務必遵守)

- **phase-gated**:每階段完成→向使用者展示驗收→核准後才 commit/push(固定 checkpoint)
- **雙語自第一天**:所有字串走 i18n key;ESLint no-restricted-syntax + `no-raw-cjk.test.ts` 掃描雙閘門;金額/日期用 Intl,禁止字串串接
- 溝通語言 zh-Hant;文件風格:emoji 標題+`English · 中文` 雙語段標
- 技術棧(定案,勿擅自更換):Expo dev(現階段 Expo Go+web)、TypeScript strict、Zustand、expo-sqlite、expo-router、i18next、Jest+React Native Testing Library
- 新增純邏輯一律配 Jest 單元測試;repo 類邏輯以介面注入(InMemory)可測;migration 測試斷言交易順序(PRAGMA user_version)
- Windows 環境教訓(沿用 TIME-Management):Jest `testTimeout: 15000`(並行負載逾時 flake);**含中文的 .ps1 一律以 pwsh 7 執行**(WinPS 5.1 誤讀 UTF-8 為 CP950 會靜默漏行);**中文檔案寫入後必掃 U+FFFD、掃淨才 commit**(P0 建案實測 5 處損壞,其中 1 處由測試如實揪出);`formatCents` 勿依賴 Intl 貨幣符號(zh-TW ICU 對本幣 TWD 呈現裸 `$`)

## 待辦排隊(2026-10-14 P0 收尾歸檔)

- **主線**:P1 房貸模組(純計算零串接)→ P2 發票對獎(開放資料)→ P3 CSV 匯入(先收集各家銀行匯出樣本)
- **待維護者拍板**:P4 載具發票查詢(需營業人統編向財政資訊中心申請 appID——有無統編決定此路開關)
- **優先度較高的工程項**:資料匯出備份(本機資料唯一備份路徑)、表單層 RNTL 測試、真機 Expo Go 驗證 SQLite 路徑
- 完整清單(產品優化候選+技術債):`docs/PLAN.md` §「待辦與優化清單」
