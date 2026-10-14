# 💰 MoneyCare · 個人財務統合

> 記帳為核心的個人財務 App——帳戶淨值、月度統計、分類洞察,所有資料 100% 留在你的裝置上。英中雙語(zh-TW / en-US)。發票對獎、房貸試算、CSV 匯入為後續分期(見 [docs/PLAN.md](./docs/PLAN.md))。

---

## 🧭 Overview · 專案概況

MoneyCare 的目標是「**一目瞭然的單一財務介面**」:消費、信用卡、帳務與資產整合在一個 App 裡。核心理念是**本機優先**——金融資料不出裝置、不連雲端;以及**誠實邊界**——台灣現況下銀行 API 個人拿不到,產品以「低摩擦手動 + 半自動歸集」為設計前提,不假裝全自動。

核心使用循環:**記一筆 / 歸集 → 帳戶淨值 → 月度統計 → 分類洞察**。

---

## ✅ Status · 專案狀態

| 分期 | 內容 | 狀態 |
|---|---|---|
| P0 | 骨架 + 記帳(帳戶/交易 CRUD、淨值、月度統計、雙語) | ✅ 完成 |
| P1 | 淨值報表深化 + 房貸模組 | 待開工 |
| P2 | 發票對獎(政府開放資料) | 待開工 |
| P3+ | CSV 匯入、載具查詢(視資格)、帳務郵件解析 | 待開工 |

**本機執行**(Expo SDK 57 / TypeScript strict):

```bash
npm install
npx expo start --web   # 瀏覽器即時預覽(web 為 InMemory,不持久化)
npx expo start         # iOS/Android(Expo Go;native 走 SQLite)
```

品質門檻:`npm run lint`(含禁寫死字串規則)、`npm test`、`npm run typecheck`;一次跑全:`npm run verify`(同 CI)。

---

## ✨ Features · 功能總覽(P0)

| 功能 | 說明 | 狀態 |
|---|---|---|
| 📒 記一筆 | 支出 / 收入 / 轉帳三類型;分類 chips、帳戶選擇、日期調整、備註 | ✅ |
| 🏦 帳戶 | 現金 / 銀行 / 信用卡;期初餘額(可負);單一餘額模型 | ✅ |
| 📊 淨值 | 總資產 / 總負債 / 淨值(信用卡消費轉負呈現) | ✅ |
| 📈 統計 | 月度導覽、收支淨三卡、支出分類分佈長條 | ✅ |
| 🔒 資料安全 | 100% 本機(SQLite/InMemory),零後端零雲端 | ✅ |
| 🌐 英中雙語 | zh-TW(預設)與 en-US 全介面,含語言切換 | ✅ |

---

## 🏗️ Architecture · 架構覽

分層架構(沿用 [TIME-Management](https://github.com/Galen-Chu/TIME-Management)(TimeCare)模式):

```
① 呈現層 Presentation   → 4 分頁(今天/帳戶/統計/設定)+ Sheet 表單
② 應用層 Application    → Zustand store(guard 錯誤防護)
③ 領域層 Domain         → 金額(分整數)、分類、餘額/淨值/統計純函式
④ 資料層 Data           → SQLite(native)/ InMemory(web)Repository + migration
```

依賴方向單向:UI→state→domain←data;領域邏輯全部純函式、可測。

---

## 📁 Project Structure · 專案結構

```
MONEY-Management/
├── README.md / CLAUDE.md / LICENSE(MIT)
├── docs/PLAN.md        # 定位、串接查證結論、D1–D6 決策、分期
├── scripts/            # 品牌圖示產生器(pwsh 7)
└── src/
    ├── app/            # expo-router 路由((tabs) 四分頁)
    ├── components/     # ui/(Card/Segmented/Sheet) + ledger/(交易/帳戶表單、列)
    ├── state/          # ledgerStore(CRUD+guard)、settings(語言)
    ├── domain/         # money/categories/ledger 純函式
    ├── data/           # repository 介面 + SQLite/InMemory + migrations
    ├── i18n/           # zh-TW / en-US locales + Intl 格式
    └── theme/          # tokens.json(單一事實來源)
```

---

## 📐 Design Principles · 設計原則

1. **本機優先**:金融資料只在裝置上;不連雲端、不上傳任何伺服器
2. **誠實邊界**:台灣銀行 API 個人不可得——不假裝全自動,以低摩擦輸入+半自動歸集為前提(見 PLAN 串接查證)
3. **正確性**:金額以「分」整數運算,杜絕浮點誤差;轉帳不影響收支統計
4. **i18n 從第一天**:所有字串走 key,禁止寫死(ESLint+掃描測試雙閘門)
5. **不做網銀爬蟲**:違反銀行服務條款+資安風險,紅線

---

## 📚 Documents · 文件索引

| 文件 | 內容 |
|---|---|
| [docs/PLAN.md](./docs/PLAN.md) | 定位、串接查證結論、決策記錄 D1–D6、分期 P0–P5 |
| [CLAUDE.md](./CLAUDE.md) | 開發指南(指令/架構/紅線/慣例) |

---

## 👤 Author

**Galen Chu**

- GitHub: [@Galen-Chu](https://github.com/Galen-Chu)
