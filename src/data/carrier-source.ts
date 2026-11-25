/**
 * 載具發票來源(P5):財政部電子發票應用 API——載具發票表頭查詢(carrierInvChk v0.3)。
 * 端點/參數依官方規格彙整(2026-11-25 複核 swagger:正式環境 api.einvoice.nat.gov.tw,
 * POST、參數全在 query string、appID 為全域 ApiKeyAuth)。查詢窗 startDate/endDate
 * 限同月(yyyy/MM/dd);onlyWinningInv=N 拉全量供「轉為交易」;愛金卡(2G0001)
 * 規格載明不支援直接查詢,卡別僅開三種。fetcher 可注入——appID 核發前以 golden
 * 回應完成開發測試驗收,實際連線待 appID 後補驗(見 PLAN §🔭)。
 */
import { termOfDate, validInvoiceNumber, type InvoiceTerm } from '../domain/invoice';

const API_URL = 'https://api.einvoice.nat.gov.tw/PB2CAPIVAN/invServ/InvServ';

/** 卡別:3J0002 手機條碼 / 1K0001 悠遊卡 / 1H0001 一卡通 */
export type CardType = '3J0002' | '1K0001' | '1H0001';

export const CARD_TYPES: readonly CardType[] = ['3J0002', '1K0001', '1H0001'];

export interface CarrierSettings {
  cardType: CardType;
  cardNo: string;
  cardEncrypt: string;
  appID: string;
}

export interface CarrierQuery {
  url: string;
  params: Record<string, string>;
}

/** 建構單月查詢(month='YYYY-MM';nowMs 可注入供測試) */
export function buildCarrierQuery(settings: CarrierSettings, month: string, nowMs = Date.now()): CarrierQuery {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y!, m!, 0).getDate();
  const nowSec = Math.floor(nowMs / 1000);
  const mm = String(m).padStart(2, '0');
  return {
    url: API_URL,
    params: {
      version: '0.3',
      cardType: settings.cardType,
      cardNo: settings.cardNo.trim(),
      cardEncrypt: settings.cardEncrypt.trim(),
      action: 'carrierInvChk',
      onlyWinningInv: 'N',
      startDate: `${y}/${mm}/01`,
      endDate: `${y}/${mm}/${last}`,
      timeStamp: String(nowSec),
      expTimeStamp: String(nowSec + 300),
      appID: settings.appID.trim(),
    },
  };
}

export type CarrierFetcher = (url: string, params: Record<string, string>) => Promise<unknown>;

export const defaultCarrierFetcher: CarrierFetcher = async (url, params) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}?${qs}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
};

export type CarrierErrorCode = 'network' | 'api' | 'parse';

export class CarrierApiError extends Error {
  readonly code: CarrierErrorCode;

  constructor(code: CarrierErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'CarrierApiError';
    this.code = code;
  }
}

/** 規格回應列(carrierInvChkDetail;欄位寬鬆以 unknown 收) */
interface ChkDetail {
  invNum?: unknown;
  cardType?: unknown;
  cardNo?: unknown;
  sellerName?: unknown;
  invStatus?: unknown;
  amount?: unknown;
  invPeriod?: unknown;
  invDate?: unknown;
}

/** 民國期別(雙數結束月,如 '11206')→ 本專案期別(奇數起始月 '11205');無效則依日期推 */
export function termFromInvPeriod(invPeriod: unknown, fallbackDate: string | null): InvoiceTerm | null {
  if (typeof invPeriod === 'string' && /^\d{5}$/.test(invPeriod)) {
    const y = invPeriod.slice(0, 3);
    const m = Number(invPeriod.slice(3, 5));
    if (m % 2 === 0) return `${y}${String(m - 1).padStart(2, '0')}`;
  }
  return fallbackDate ? termOfDate(fallbackDate) : null;
}

/** invDate:Chk 回應為 {year(民國), month, date} 物件;他處為 yyyyMMdd 字串——皆轉 ISO */
export function isoOfInvDate(invDate: unknown): string | null {
  if (typeof invDate === 'string' && /^\d{8}$/.test(invDate)) {
    const m = Number(invDate.slice(4, 6));
    const d = Number(invDate.slice(6, 8));
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${invDate.slice(0, 4)}-${invDate.slice(4, 6)}-${invDate.slice(6, 8)}`;
  }
  if (invDate && typeof invDate === 'object') {
    const o = invDate as { year?: unknown; month?: unknown; date?: unknown };
    const y = Number(o.year);
    const m = Number(o.month);
    const d = Number(o.date);
    if (Number.isInteger(y) && y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y + 1911)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

/** 金額(字串或數字)→ 分;無效回 null */
export function centsOfAmount(amount: unknown): number | null {
  if (typeof amount !== 'string' && typeof amount !== 'number') return null;
  const v = Math.round(parseFloat(String(amount).replace(/,/g, '')) * 100);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export interface NormalizedCarrierInvoice {
  number: string;
  term: InvoiceTerm;
  date: string | null;
  sellerName: string | null;
  amountCents: number | null;
  cardType: string | null;
}

/** 正規化單列;號碼或期別不合格回 null(呼叫端過濾) */
export function normalizeCarrierDetail(d: ChkDetail): NormalizedCarrierInvoice | null {
  const number = typeof d.invNum === 'string' ? d.invNum.trim().toUpperCase() : '';
  if (!validInvoiceNumber(number)) return null;
  const date = isoOfInvDate(d.invDate);
  const term = termFromInvPeriod(d.invPeriod, date);
  if (!term) return null;
  return {
    number,
    term,
    date,
    sellerName: typeof d.sellerName === 'string' && d.sellerName.trim() ? d.sellerName.trim() : null,
    amountCents: centsOfAmount(d.amount),
    cardType: typeof d.cardType === 'string' ? d.cardType : null,
  };
}

/** 查詢單月載具發票;HTTP 層失敗 → network、API code≠200 → api(附 msg) */
export async function fetchCarrierMonth(
  settings: CarrierSettings,
  month: string,
  fetcher: CarrierFetcher = defaultCarrierFetcher
): Promise<NormalizedCarrierInvoice[]> {
  const { url, params } = buildCarrierQuery(settings, month);
  let raw: unknown;
  try {
    raw = await fetcher(url, params);
  } catch (e) {
    throw e instanceof CarrierApiError ? e : new CarrierApiError('network', String(e));
  }
  const res = raw as { code?: unknown; msg?: unknown; details?: unknown };
  if (!res || typeof res !== 'object' || String(res.code ?? '') !== '200') {
    throw new CarrierApiError('api', typeof res?.msg === 'string' ? res.msg : String(res?.code));
  }
  if (!Array.isArray(res.details)) return [];
  return res.details.map(normalizeCarrierDetail).filter((x): x is NormalizedCarrierInvoice => x !== null);
}
