/** CSV 匯入領域測試:剖析(BOM/引號/CRLF/定位點)、日期(西元/民國)、金額解析、欄位偵測、列轉換。 */
import {
  normalizeDate,
  parseAmountToCents,
  parseCsv,
  rowsToTxns,
  sniffDelimiter,
  sniffSchema,
  type ImportOptions,
} from '../csv';
import type { Account } from '../ledger';

const ACCOUNTS: Account[] = [
  { id: 'a1', name: '現金', type: 'cash', initialCents: 0, createdAt: 1 },
];

const OPTS: ImportOptions = {
  accountId: 'a1',
  expenseCategory: 'other',
  incomeCategory: 'otherIncome',
  accounts: ACCOUNTS,
};

describe('parseCsv / sniffDelimiter', () => {
  it('引號欄位含逗號與跳脫引號、CRLF、BOM', () => {
    const text = '﻿日期,說明,金額\r\n2026/01/05,"午餐,加飯",250\r\n2026/01/06,"7-11 ""咖啡""",-90\n';
    expect(parseCsv(text)).toEqual([
      ['日期', '說明', '金額'],
      ['2026/01/05', '午餐,加飯', '250'],
      ['2026/01/06', '7-11 "咖啡"', '-90'],
    ]);
  });

  it('定位點分隔嗅探;空列濾除;末欄保留', () => {
    const text = '日期\t說明\t金額\n2026-01-05\t超市\t1,000\n\n\n';
    expect(parseCsv(text)).toEqual([
      ['日期', '說明', '金額'],
      ['2026-01-05', '超市', '1,000'],
    ]);
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(sniffDelimiter('a;b;c')).toBe(';');
    expect(sniffDelimiter('單行無分隔')).toBe(',');
  });
});

describe('normalizeDate / parseAmountToCents', () => {
  it('西元三種分隔與補零;民國年+1911', () => {
    expect(normalizeDate('2026/1/5')).toBe('2026-01-05');
    expect(normalizeDate('2026-01-05')).toBe('2026-01-05');
    expect(normalizeDate('2026.12.31')).toBe('2026-12-31');
    expect(normalizeDate('115/7/8')).toBe('2026-07-08');
    expect(normalizeDate('2026-13-01')).toBeNull();
    expect(normalizeDate('不是日期')).toBeNull();
  });

  it('金額:千分位/貨幣符號/括號負/小數', () => {
    expect(parseAmountToCents('1,234.5')).toBe(123_450);
    expect(parseAmountToCents('-500')).toBe(-50_000);
    expect(parseAmountToCents('(300)')).toBe(-30_000);
    expect(parseAmountToCents('NT$1,000')).toBe(100_000);
    expect(parseAmountToCents('0')).toBe(0);
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
  });
});

describe('sniffSchema', () => {
  it('支出/存入雙欄(銀行明細風格)', () => {
    const rows = parseCsv(
      '交易日期,交易說明,支出,存入\n2026/01/05,全聯,350,\n2026/01/06,薪資,,50000\n2026/01/07,咖啡,120,'
    );
    const schema = sniffSchema(rows)!;
    expect(schema.header).toBe(true);
    expect(schema.dateCol).toBe(0);
    expect(schema.descCol).toBe(1);
    expect(schema.debitCol).toBe(2);
    expect(schema.creditCol).toBe(3);
    expect(schema.amountCol).toBeNull();
  });

  it('單欄正負金額(記帳 App 匯出風格)', () => {
    const rows = parseCsv('日期,說明,金額\n2026/01/05,午餐,-120\n2026/01/06,紅包,2000');
    const schema = sniffSchema(rows)!;
    expect(schema.amountCol).toBe(2);
    expect(schema.debitCol).toBeNull();
    expect(schema.creditCol).toBeNull();
    expect(schema.dateCol).toBe(0);
  });

  it('無法偵測(缺日期或金額)→ null', () => {
    expect(sniffSchema(parseCsv('a,b,c\n1,2,3\n4,5,6'))).toBeNull();
    expect(sniffSchema(parseCsv('日期\n2026/01/05'))).toBeNull();
  });
});

describe('rowsToTxns', () => {
  it('雙欄:支出/收入分向、分類與備註', () => {
    const rows = parseCsv('日期,說明,支出,存入\n2026/01/05,全聯,350,\n2026/01/06,薪資,,50000');
    const schema = sniffSchema(rows)!;
    const r = rowsToTxns(rows, schema, OPTS);
    expect(r.skipped).toBe(0);
    expect(r.txns).toHaveLength(2);
    expect(r.txns[0]).toMatchObject({ date: '2026-01-05', type: 'expense', amountCents: 35_000, note: '全聯', accountId: 'a1' });
    expect(r.txns[1]).toMatchObject({ date: '2026-01-06', type: 'income', amountCents: 5_000_000, category: 'otherIncome' });
  });

  it('單欄:正負定方向、絕對值入帳;跳過 0 與壞列', () => {
    const rows = parseCsv('日期,說明,金額\n2026/01/05,午餐,-120\n2026/01/06,紅包,2000\n2026/01/07,??,0\n壞列,x,y');
    const schema = sniffSchema(rows.slice(0, 4))!; // 壞列不影響偵測
    const r = rowsToTxns(rows, schema, OPTS);
    expect(r.txns.map((t) => t.type)).toEqual(['expense', 'income']);
    expect(r.txns[0]!.amountCents).toBe(12_000);
    expect(r.skipped).toBe(2);
  });

  it('目標帳戶不存在 → validateTxn 擋下全數跳過', () => {
    const rows = parseCsv('日期,說明,金額\n2026/01/05,午餐,-120');
    const schema = sniffSchema(rows)!;
    const r = rowsToTxns(rows, schema, { ...OPTS, accountId: 'nope', accounts: [] });
    expect(r.txns).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });
});
