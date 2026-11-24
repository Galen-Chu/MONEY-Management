/**
 * 獎號來源:稅務入口網每期公告頁(政府資料開放宣告)。
 * URL 為確定性組合:https://www.etax.nat.gov.tw/etw-main/ETW183W2_{民國年}{起始月}
 * (查證 2026-11-24;解析為純函式 domain/invoice.parsePrizeHtml,測試以注入 fetcher 覆蓋)。
 * 抓取頻率極低(每期一次)、僅公開獎號——非個人資料,快取於本機 prize_numbers 表。
 */
import { parsePrizeHtml, type InvoiceTerm, type PrizeNumbers } from '../domain/invoice';

const BASE_URL = 'https://www.etax.nat.gov.tw/etw-main/ETW183W2_';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type HtmlFetcher = (url: string) => Promise<string>;

export const defaultFetcher: HtmlFetcher = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
};

/** 抓取某期獎號;失敗(網路/版面變動)外拋,由 store 寫入 error 狀態 */
export async function fetchPrizeNumbers(
  term: InvoiceTerm,
  fetcher: HtmlFetcher = defaultFetcher
): Promise<PrizeNumbers> {
  const html = await fetcher(`${BASE_URL}${term}`);
  const prizes = parsePrizeHtml(html, term, Date.now());
  if (!prizes) throw new Error('PRIZE_PARSE_FAILED');
  return prizes;
}
