/**
 * 金額領域(D2 決策):一律以「分」的整數儲存與運算,避免浮點誤差;
 * 呈現時才轉回「元」並以 Intl 格式化(TWD,無小數時不顯示小數位)。
 */

/** 元 → 分(四捨五入;輸入來自 TextInput 的十進位字串) */
export function toCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 分 → 元 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * 分 → 貨幣字串。Intl 只負責千分位/小數;前綴固定 "NT$"——
 * zh-TW 的 ICU 對本幣 TWD 呈現裸 "$"(不带 NT),跨 ICU 版本不一致,
 * 故不依賴 currency style 的符號;負號置於前綴前("-NT$2.5")。
 */
export function formatCents(cents: number, locale: string): string {
  const hasFraction = Math.abs(cents) % 100 !== 0;
  const digits = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(Math.abs(fromCents(cents)));
  return `${cents < 0 ? '-' : ''}NT$${digits}`;
}

/** 解析金額輸入:空字串/NaN/非正數 → null(UI 顯示驗證錯誤) */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
