/**
 * CSV 匯入領域(P4,純函式):RFC4180 剖析(引號/跳脫/CRLF/BOM)、分隔符嗅探(逗號/分號/定位點)、
 * 欄位自動偵測(表頭關鍵字→型態启发)、列→TxnInput 轉換(驗證走 ledger.validateTxn)。
 * 編碼限 UTF-8(含 BOM);Big5 檔請先轉存 UTF-8(限制見 PLAN)。
 */
import { validateTxn, type Account, type TxnInput } from './ledger';
import type { CategoryKey } from './categories';

/** 分隔符嗅探:取第一個非空行,比較 , ; \t 出現次數(無命中回 ',') */
export function sniffDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const counts: Array<[string, number]> = [
    [',', (firstLine.match(/,/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ',';
}

/** RFC4180 剖析;濾除全空列 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const delim = sniffDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || (c === '\r' && src[i + 1] !== '\n')) {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// ── 儲存格解析 ─────────────────────────────────────────────

/** 西元 YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD,或民國 YYY/MM/DD → 'YYYY-MM-DD';無法解析回 null */
export function normalizeDate(cell: string): string | null {
  const t = cell.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return fmt(m[1]!, m[2]!, m[3]!);
  m = /^(\d{2,3})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t); // 民國年(2-3 碼)
  if (m) return fmt(String(Number(m[1]!) + 1911), m[2]!, m[3]!);
  return null;
}

function fmt(y: string, mm: string, dd: string): string | null {
  const yi = Number(y);
  const mi = Number(mm);
  const di = Number(dd);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
  return `${String(yi).padStart(4, '0')}-${String(mi).padStart(2, '0')}-${String(di).padStart(2, '0')}`;
}

function looksLikeDate(cell: string): boolean {
  return normalizeDate(cell) != null;
}

/** 金額字串 → 分;支援千分位/NT$/$/(負號括號)/小數;非有限數回 null */
export function parseAmountToCents(cell: string): number | null {
  let t = cell.trim();
  if (!t) return null;
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  // 貨幣字樣移除(元=元、新臺幣=新臺幣)
  t = t.replace(/(NT\$|nt\$|\$|\u5143|\u65B0\u81FA\u5E63)/g, '');
  t = t.replace(/,/g, '').replace(/\s/g, '');
  if (t.startsWith('-')) {
    negative = true;
    t = t.slice(1);
  }
  if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return negative ? -cents : cents;
}

function looksLikeAmount(cell: string): boolean {
  return parseAmountToCents(cell) != null;
}

// ── 欄位自動偵測 ───────────────────────────────────────────

export interface CsvSchema {
  /** 是否含表頭列 */
  header: boolean;
  dateCol: number;
  /** 單一金額欄(含正負);與 debit/credit 二擇一 */
  amountCol: number | null;
  /** 支出欄(正數金額;與 creditCol 成對) */
  debitCol: number | null;
  /** 存入/收入欄(正數金額) */
  creditCol: number | null;
  /** 說明/摘要欄 */
  descCol: number | null;
  /** 備註欄(可併入說明) */
  noteCol: number | null;
}

// 表頭關鍵字(\u 轉義維持 CJK 閘門;對應中文:日期/時間/交易日、
// 支出/提款/出帳/付款/轉出、存入/收入/入帳/存款/轉入、金額、說明/摘要/描述/交易內容/備註/明細)
const KW = {
  date: /\u65E5\u671F|\u6642\u9593|\u4EA4\u6613\u65E5|date/i,
  debit: /\u652F\u51FA|\u63D0\u6B3E|\u51FA\u5E33|\u4ED8\u6B3E|\u8F49\u51FA|debit|withdraw/i,
  credit: /\u5B58\u5165|\u6536\u5165|\u5165\u5E33|\u5B58\u6B3E|\u8F49\u5165|credit|deposit/i,
  amount: /\u91D1\u984D|amount/i,
  desc: /\u8AAA\u660E|\u6458\u8981|\u63CF\u8FF0|\u4EA4\u6613\u5167\u5BB9|\u5099\u8A3B|\u660E\u7D30|description|note/i,
};

/** 依表頭關鍵字與資料型態啟發偵測欄位;失敗回 null(呼叫端讓使用者手動映射) */
export function sniffSchema(rows: string[][]): CsvSchema | null {
  if (rows.length < 2) return null;
  const first = rows[0]!;
  const hasHeader = !looksLikeDate(first.find((c) => looksLikeDate(c)) ?? '') && first.some((c) => KW.date.test(c) || KW.amount.test(c) || KW.desc.test(c));
  const body = hasHeader ? rows.slice(1) : rows;
  const headerCells = hasHeader ? first : [];
  const width = Math.max(...rows.map((r) => r.length));

  // 日期欄:表頭關鍵字優先,否則取最多列符合日期格式的欄
  let dateCol = -1;
  if (hasHeader) {
    dateCol = headerCells.findIndex((c) => KW.date.test(c));
  }
  if (dateCol < 0) {
    let best = -1;
    let bestHits = 0;
    for (let col = 0; col < width; col++) {
      const hits = body.filter((r) => looksLikeDate(r[col] ?? '')).length;
      if (hits > bestHits) {
        bestHits = hits;
        best = col;
      }
    }
    if (bestHits < body.length / 2) return null;
    dateCol = best;
  }

  // 金額欄:數值命中率高的欄(排除日期欄)
  const numericCols: number[] = [];
  for (let col = 0; col < width; col++) {
    if (col === dateCol) continue;
    const hits = body.filter((r) => looksLikeAmount(r[col] ?? '')).length;
    if (hits >= body.length / 2) numericCols.push(col);
  }

  const findHeaderCol = (re: RegExp): number | null => {
    if (!hasHeader) return null;
    const i = headerCells.findIndex((c) => re.test(c) && headerCells.indexOf(c) !== dateCol);
    return i >= 0 ? i : null;
  };

  let debitCol = findHeaderCol(KW.debit);
  let creditCol = findHeaderCol(KW.credit);
  if (debitCol != null && creditCol != null && debitCol !== creditCol) {
    return { header: hasHeader, dateCol, amountCol: null, debitCol, creditCol, descCol: findHeaderCol(KW.desc), noteCol: null };
  }
  debitCol = null;
  creditCol = null;

  // 說明欄:關鍵字或最長文字欄
  let descCol = findHeaderCol(KW.desc);
  if (descCol == null) {
    let best = -1;
    let bestLen = 0;
    for (let col = 0; col < width; col++) {
      if (col === dateCol || numericCols.includes(col)) continue;
      const len = body.reduce((s, r) => s + (r[col] ?? '').trim().length, 0);
      if (len > bestLen) {
        bestLen = len;
        best = col;
      }
    }
    descCol = best >= 0 ? best : null;
  }

  if (numericCols.length >= 2 && hasHeader) {
    // 兩個以上數值欄且無支出/存入表頭 → 依金額關鍵字猜,不成對則退回單欄
    const amountHeader = findHeaderCol(KW.amount);
    if (amountHeader != null) {
      return { header: hasHeader, dateCol, amountCol: amountHeader, debitCol: null, creditCol: null, descCol, noteCol: null };
    }
  }

  const amountCol = numericCols.length > 0 ? numericCols[numericCols.length - 1]! : null;
  if (dateCol < 0 || (amountCol == null && debitCol == null)) return null;
  return { header: hasHeader, dateCol, amountCol, debitCol, creditCol, descCol, noteCol: null };
}

// ── 列 → 交易 ─────────────────────────────────────────────

export interface ImportOptions {
  accountId: string;
  /** 支出分類(預設 other) */
  expenseCategory: CategoryKey;
  /** 收入分類(預設 otherIncome) */
  incomeCategory: CategoryKey;
  accounts: Account[];
}

export interface ImportResult {
  txns: TxnInput[];
  skipped: number;
}

/** 依 schema 逐列轉換;單欄正負定方向,雙欄(支出/存入)依欄位值;每筆經 validateTxn,不合格跳過 */
export function rowsToTxns(rows: string[][], schema: CsvSchema, opts: ImportOptions): ImportResult {
  const body = schema.header ? rows.slice(1) : rows;
  const txns: TxnInput[] = [];
  let skipped = 0;
  for (const r of body) {
    const date = normalizeDate(r[schema.dateCol] ?? '');
    if (!date) {
      skipped++;
      continue;
    }
    let type: 'expense' | 'income';
    let amountCents: number;
    if (schema.debitCol != null && schema.creditCol != null) {
      const debit = parseAmountToCents(r[schema.debitCol] ?? '');
      const credit = parseAmountToCents(r[schema.creditCol] ?? '');
      if (debit != null && debit > 0) {
        type = 'expense';
        amountCents = debit;
      } else if (credit != null && credit > 0) {
        type = 'income';
        amountCents = credit;
      } else {
        skipped++;
        continue;
      }
    } else if (schema.amountCol != null) {
      const amount = parseAmountToCents(r[schema.amountCol] ?? '');
      if (amount == null || amount === 0) {
        skipped++;
        continue;
      }
      type = amount > 0 ? 'income' : 'expense';
      amountCents = Math.abs(amount);
    } else {
      skipped++;
      continue;
    }
    const desc = (r[schema.descCol ?? -1] ?? '').trim();
    const note = (r[schema.noteCol ?? -1] ?? '').trim();
    const input: TxnInput = {
      date,
      type,
      amountCents,
      category: type === 'expense' ? opts.expenseCategory : opts.incomeCategory,
      accountId: opts.accountId,
      toAccountId: null,
      note: note ? (desc ? `${desc} ${note}` : note) : desc,
    };
    if (validateTxn(input, opts.accounts)) {
      skipped++;
      continue;
    }
    txns.push(input);
  }
  return { txns, skipped };
}
