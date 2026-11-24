/**
 * 日期/月份格式化(Intl,禁止字串串接組日期)。
 */
import type { Language } from './index';

function localeOf(lang: Language): string {
  return lang === 'en-US' ? 'en-US' : 'zh-TW';
}

/** YYYY-MM-DD → 「M/D(週三)」/「Wed, M/D」 */
export function formatDayLabel(date: string, lang: Language): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(localeOf(lang), {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(y!, m! - 1, d!));
}

/** YYYY-MM → 「2026年10月」/「October 2026」 */
export function formatMonthLabel(month: string, lang: Language): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(localeOf(lang), {
    year: 'numeric',
    month: 'long',
  }).format(new Date(y!, m! - 1, 1));
}

/** 年利率(milliPercent=0.001% 單位)→ 「2.185」(最多 3 位小數;UI 自行接 %) */
export function formatRatePercent(milliPercent: number, lang: Language): string {
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 3 }).format(milliPercent / 1000);
}

/** 發票期別組成(民國年/西元年/起訖月);顯示模板走 i18n key `invoice.periodLabel` */
export function termPeriodInfo(term: string): { rocYear: number; gregYear: number; fromMonth: number; toMonth: number } {
  const rocYear = Number(term.slice(0, 3));
  const fromMonth = Number(term.slice(3, 5));
  return { rocYear, gregYear: rocYear + 1911, fromMonth, toMonth: fromMonth + 1 };
}

/** 月標籤:en 走 Intl 縮寫(Jul),zh 回數字 */
export function monthLabel(month: number, lang: Language): string {
  if (lang === 'en-US') {
    return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2000, month - 1, 1));
  }
  return String(month);
}
