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
