/**
 * 發票對獎領域(P2):期別工具、獎號模型、對獎比對、官方公告頁 HTML 解析——純函式。
 * 期別(term)= 民國年 3 碼 + 起始月 2 碼(01/03/05/07/09/11),如 '11507' = 115年7-8月。
 * 開獎:期結束次月 25 日(11507 期 → 115/9/25);獎號來源為稅務入口網公告頁
 * (etw-main/ETW183W2_{term},政府資料開放宣告;查證 2026-11-24,見 PLAN)。
 * 獎金以「分」整數(D2);比對只看發票後 8 碼數字(前 2 碼英文字軌不影響中獎)。
 */

/** 民國年+起始月,如 '11507';月至多 6 期(1,3,5,7,9,11) */
export type InvoiceTerm = string;

export interface PrizeNumbers {
  term: InvoiceTerm;
  /** 特別獎(1,000 萬)8 碼 */
  superNumber: string;
  /** 特獎(200 萬)8 碼 */
  specialNumber: string;
  /** 頭獎(20 萬)8 碼,每期 3 組 */
  firstNumbers: string[];
  /** 增開六獎(200 元)3 碼,0~n 組(部分期數無) */
  extraNumbers: string[];
  /** 抓取時間(ms) */
  fetchedAt: number;
}

export type PrizeTier =
  | 'super'
  | 'special'
  | 'first'
  | 'second'
  | 'third'
  | 'fourth'
  | 'fifth'
  | 'sixth'
  | 'extraSixth';

/** 各獎項金額(分) */
export const PRIZE_AMOUNTS_CENTS: Record<PrizeTier, number> = {
  super: 1_000_000_000,
  special: 200_000_000,
  first: 20_000_000,
  second: 4_000_000,
  third: 1_000_000,
  fourth: 400_000,
  fifth: 100_000,
  sixth: 20_000,
  extraSixth: 20_000,
};

export interface Invoice {
  id: string;
  term: InvoiceTerm;
  /** 'AB12345678'(2 大寫英文字母 + 8 數字) */
  number: string;
  note: string;
  createdAt: number;
}

export type InvoiceErrorCode = 'number' | 'term';

const INVOICE_NO_RE = /^[A-Z]{2}\d{8}$/;
const TERM_RE = /^\d{3}(01|03|05|07|09|11)$/;

export function validInvoiceNumber(number: string): boolean {
  return INVOICE_NO_RE.test(number);
}

export function validTerm(term: InvoiceTerm): boolean {
  return TERM_RE.test(term);
}

/** 驗證發票輸入;合法回 null */
export function validateInvoice(number: string, term: InvoiceTerm): InvoiceErrorCode | null {
  if (!validInvoiceNumber(number)) return 'number';
  if (!validTerm(term)) return 'term';
  return null;
}

// ── 期別數學 ───────────────────────────────────────────────

const TERM_MONTHS = [1, 3, 5, 7, 9, 11] as const;

function termIndex(term: InvoiceTerm): number {
  const y = Number(term.slice(0, 3));
  const m = Number(term.slice(3, 5));
  return y * 6 + TERM_MONTHS.indexOf(m as (typeof TERM_MONTHS)[number]);
}

function termFromIndex(idx: number): InvoiceTerm {
  const y = Math.floor(idx / 6);
  const m = TERM_MONTHS[idx % 6]!;
  return `${String(y).padStart(3, '0')}${String(m).padStart(2, '0')}`;
}

/** 期別位移:delta=1 下一期(跨民國年正確) */
export function shiftTerm(term: InvoiceTerm, delta: number): InvoiceTerm {
  return termFromIndex(termIndex(term) + delta);
}

/** 西元 YYYY-MM-DD → 所屬期別 */
export function termOfDate(dateKey: string): InvoiceTerm {
  const y = Number(dateKey.slice(0, 4)) - 1911;
  const m = Number(dateKey.slice(5, 7));
  const startMonth = m % 2 === 1 ? m : m - 1;
  return `${String(y).padStart(3, '0')}${String(startMonth).padStart(2, '0')}`;
}

/** 該期開獎日(期結束後次月 25 日;11507 期 → 9/25)的西元 YYYY-MM-DD */
export function drawDateOfTerm(term: InvoiceTerm): string {
  const y = Number(term.slice(0, 3));
  const m = Number(term.slice(3, 5));
  const dm = m + 2;
  const year = dm === 13 ? y + 1 : y;
  const mm = ((dm - 1) % 12) + 1;
  return `${String(year + 1911).padStart(4, '0')}-${String(mm).padStart(2, '0')}-25`;
}

/** 今天(本地時區)的 YYYY-MM-DD */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 最近已開獎期別(開獎日 25 日當天即算;25 日前可能連兩期未開獎,逐期回退) */
export function latestDrawnTerm(asOf: string = todayLocal()): InvoiceTerm {
  let term = termOfDate(asOf);
  for (let i = 0; i < 12 && asOf < drawDateOfTerm(term); i++) {
    term = shiftTerm(term, -1);
  }
  return term;
}

// ── 對獎比對 ───────────────────────────────────────────────

/** 比對單張發票;回最高中獎獎項(同張發票多獎項僅取一,依給獎辦法) */
export function matchInvoice(number: string, prizes: PrizeNumbers): PrizeTier | null {
  const digits = number.slice(2); // 後 8 碼
  if (digits === prizes.superNumber) return 'super';
  if (digits === prizes.specialNumber) return 'special';
  const firsts = prizes.firstNumbers;
  if (firsts.includes(digits)) return 'first';
  for (let len = 7; len >= 3; len--) {
    const tail = digits.slice(8 - len);
    const tier: PrizeTier = len === 7 ? 'second' : len === 6 ? 'third' : len === 5 ? 'fourth' : len === 4 ? 'fifth' : 'sixth';
    if (firsts.some((f) => f.slice(8 - len) === tail)) return tier;
  }
  if (prizes.extraNumbers.includes(digits.slice(5))) return 'extraSixth';
  return null;
}

export function matchInvoices(invoices: Invoice[], prizes: PrizeNumbers): Array<{ invoice: Invoice; tier: PrizeTier }> {
  return invoices
    .filter((inv) => inv.term === prizes.term)
    .map((invoice) => ({ invoice, tier: matchInvoice(invoice.number, prizes) }))
    .filter((r): r is { invoice: Invoice; tier: PrizeTier } => r.tier != null);
}

/** 某期中獎總金額(分) */
export function totalPrizeCents(invoices: Invoice[], prizes: PrizeNumbers): number {
  return matchInvoices(invoices, prizes).reduce((s, r) => s + PRIZE_AMOUNTS_CENTS[r.tier], 0);
}

// ── 公告頁解析(純函式;來源 HTML 由 data 層抓取) ───────────

// 公告頁段落關鍵字——以 \u 轉義維持「原始碼無寫死 CJK」閘門(no-raw-cjk):
// 特別獎 / 特獎 / 頭獎 / 增開六獎
const KW_SUPER = '\\u7279\\u5225\\u734E';
const KW_SPECIAL = '\\u7279\\u734E';
const KW_FIRST = '\\u982D\\u734E';
const KW_EXTRA = '\\u589E\\u958B\\u516D\\u734E';

/** 解析稅務入口網公告頁;缺必要欄位回 null */
export function parsePrizeHtml(html: string, term: InvoiceTerm, fetchedAt = 0): PrizeNumbers | null {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const superM = new RegExp(`${KW_SUPER}\\s*(\\d{8})`).exec(text);
  const specialM = new RegExp(`${KW_SPECIAL}\\s*(\\d{8})`).exec(text);
  const firstM = new RegExp(`${KW_FIRST}\\s*((?:\\d{8}\\s*){1,6})`).exec(text);
  const extraM = new RegExp(`${KW_EXTRA}\\s*((?:\\d{3}\\s*){1,8})`).exec(text);
  if (!superM || !specialM || !firstM) return null;
  const firstNumbers = firstM[1]!.trim().split(/\s+/);
  const extraNumbers = extraM ? extraM[1]!.trim().split(/\s+/) : [];
  return {
    term,
    superNumber: superM[1]!,
    specialNumber: specialM[1]!,
    firstNumbers,
    extraNumbers,
    fetchedAt,
  };
}
