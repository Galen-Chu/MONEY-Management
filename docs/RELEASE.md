# 🚀 iOS 發佈手冊 · Release Runbook

> P0.7 產物:MoneyCare 的 TestFlight 自用發佈管線。決策依據見 `docs/PLAN.md` D8(年費 US$99、雲端建置、build 90 天效期)。
> 本機為 Windows,無法本機建置 iOS——一律走 Expo 雲端建置(免費額度每月 15 次 iOS,低優先佇列尖峰可逾 90 分鐘)。

## 🧱 前置 · Prerequisites(一次性,維護者動作)

| # | 項目 | 動作 | 備註 |
|---|---|---|---|
| 1 | Apple Developer Program | developer.apple.com → Account → Program 加入(個人,年費 US$99) | 台灣身份審核約 1–2 天,最長前置,先辦 |
| 2 | Expo 帳號登入 | 專案終端執行 `npx eas login`(expo.dev 帳號) | 雲端建置與 EAS 專案歸屬;之後本 shell 內可直接建置 |
| 3 | iPhone 準備 | App Store 安裝免費的 **TestFlight** App | 安裝目標 |

## 🔨 建置與提交 · Build & Submit

```bash
npx eas build --platform ios --profile production   # 雲端建置 IPA(Windows 可行)
npx eas submit --platform ios --profile production  # 上傳 App Store Connect → TestFlight
# 或一次到底:
npx eas build --platform ios --profile production --auto-submit
```

首次執行會互動式詢問(照提示走即可):

1. **建立 EAS 專案**——同意後 EAS 把 `extra.eas.projectId` 寫回 `app.json`(此檔案隨建置變更,記得 commit)。
2. **Apple 登錄**——Apple ID + 密碼 + 雙因子驗證碼;EAS 自動建立 distribution certificate 與 provisioning profile(存於 EAS 伺服器,之後不必再管)。
3. **Bundle ID 註冊**——確認 `com.galenchu.moneycare` 註冊到你的 Apple 帳號。

`eas.json` 內建兩個 profile:

- `production`——正式 IPA,`autoIncrement` 自動遞增 build number。
- `simulator`——iOS 模擬器 build(不需 Apple 開發者帳號);Windows 跑不了模擬器,僅作雲端編譯煙霧測試用。

## 📲 安裝 · Install(TestFlight 自用)

1. App Store Connect(web)→ My Apps → **MoneyCare** → TestFlight 分頁 → 內部測試(Internal Testing)新增群組,把自己(Apple ID)加為 Internal Tester——**內部測試免 Beta 審核**。
2. iPhone 的 TestFlight App 會出現邀請 → 接受 → 安裝 MoneyCare。

## 🔒 App Store Connect 首次設定 · One-time Setup

- **隱私標籤**:Privacy → 營運資料隱私實務 → 選「**未收集資料 / Data Not Collected**」(D5:金融資料 100% 本機,零後端)。
- 若日後要對外公開上架再補:說明文案、截圖、年齡分級;自用 TestFlight 不需要。

## 🔄 90 天更新 · Renewal

- TestFlight build 效期 **90 天**:到期前重跑 build + submit(`autoIncrement` 會自動升 build number,不需手動改版號)。建議日曆設每季提醒。
- `app.json` 的 `version`(如 1.0.0)是語意版,功能性變更時手動升;build number 交給 EAS。
- 純 JS 變更未來可評估 OTA(`eas update`)即時推送、免重 build;目前未啟用。

## 🩺 驗收清單 · Acceptance

- [ ] `npx eas build --platform ios --profile production` 雲端完成、無錯
- [ ] `npx eas submit` 後 App Store Connect 出現 build,TestFlight 可安裝
- [ ] iPhone 開啟不閃退;四分頁、記一筆、語言切換正常
- [ ] **native 路徑實測**(補 P0 技術債):新增帳戶+交易 → 完全關閉 App 重開 → 資料仍在(expo-sqlite 持久化真機驗證)
- [ ] web 預覽(`npx expo start --web`)不受影響

## ⚠️ 常見卡點 · Troubleshooting

| 症狀 | 解法 |
|---|---|
| Apple 身份審核逾 48 小時 | developer.apple.com → Contact Us 詢問進度 |
| build 排隊很久 | 免費額度走低優先佇列,尖峰 >90 分鐘屬常態;勿重複送建浪費額度 |
| 憑證/描述檔衝突 | `npx eas credentials -p ios` 檢查或重建 |
| 建置失敗 | 先跑 `npx expo-doctor` 與 `npm run verify`,把紅字清完再建 |
| TestFlight 顯示「缺少合規文件」 | Build 需回答出口合規(Encrypt:否/標準加密豁免)——首次在 ASC 點掉即可 |
