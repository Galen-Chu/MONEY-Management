/** 發票對獎領域測試:期別數學(跨年/開獎日 25 日界)、驗證、對獎全獎項(golden=115年7-8月實際獎號)、公告頁解析。 */
import {
  PRIZE_AMOUNTS_CENTS,
  drawDateOfTerm,
  latestDrawnTerm,
  matchInvoice,
  parsePrizeHtml,
  shiftTerm,
  termOfDate,
  totalPrizeCents,
  validateInvoice,
  type Invoice,
  type PrizeNumbers,
} from '../invoice';

/** 115年7-8月實際獎號(稅務入口網公告,2026-11-24 查證) */
const PRIZES_11507: PrizeNumbers = {
  term: '11507',
  superNumber: '89996565',
  specialNumber: '91098182',
  firstNumbers: ['54348835', '44991397', '06595111'],
  extraNumbers: [],
  fetchedAt: 1,
};

describe('驗證', () => {
  it('號碼:2 大寫英文+8 數字', () => {
    expect(validateInvoice('AB12345678', '11507')).toBeNull();
    expect(validateInvoice('ab12345678', '11507')).toBe('number');
    expect(validateInvoice('A12345678', '11507')).toBe('number');
    expect(validateInvoice('AB1234567', '11507')).toBe('number');
    expect(validateInvoice('AB123456789', '11507')).toBe('number');
  });

  it('期別:民國年+奇數起始月', () => {
    expect(validateInvoice('AB12345678', '11501')).toBeNull();
    expect(validateInvoice('AB12345678', '11511')).toBeNull();
    expect(validateInvoice('AB12345678', '11508')).toBe('term');
    expect(validateInvoice('AB12345678', '1157')).toBe('term');
  });
});

describe('期別數學', () => {
  it('shiftTerm 跨民國年', () => {
    expect(shiftTerm('11511', 1)).toBe('11601');
    expect(shiftTerm('11601', -1)).toBe('11511');
    expect(shiftTerm('11507', 1)).toBe('11509');
    expect(shiftTerm('11501', -1)).toBe('11411');
  });

  it('termOfDate:偶月歸前期', () => {
    expect(termOfDate('2026-11-24')).toBe('11511');
    expect(termOfDate('2026-12-05')).toBe('11511');
    expect(termOfDate('2027-01-05')).toBe('11601');
    expect(termOfDate('2026-02-10')).toBe('11501');
  });

  it('drawDateOfTerm:期結束後次月 25 日(跨年)', () => {
    expect(drawDateOfTerm('11507')).toBe('2026-09-25');
    expect(drawDateOfTerm('11511')).toBe('2027-01-25');
    expect(drawDateOfTerm('11501')).toBe('2026-03-25');
  });

  it('latestDrawnTerm:25 日前可能連兩期未開獎(逐期回退)', () => {
    expect(latestDrawnTerm('2026-11-24')).toBe('11507'); // 11509 期 11/25 才開
    expect(latestDrawnTerm('2026-11-25')).toBe('11509'); // 開獎當天即算
    expect(latestDrawnTerm('2026-09-25')).toBe('11507');
  });
});

describe('對獎(golden=11507 期)', () => {
  const cases: Array<[string, string | null]> = [
    ['AB89996565', 'super'],
    ['CD91098182', 'special'],
    ['EF54348835', 'first'],
    ['GH14348835', 'second'], // 末 7 碼 4348835
    ['IJ99348835', 'third'], // 末 6 碼 348835
    ['KL99948835', 'fourth'], // 末 5 碼 48835
    ['MN99998835', 'fifth'], // 末 4 碼 8835
    ['OP99999835', 'sixth'], // 末 3 碼 835
    ['ZZ00000000', null],
  ];

  it.each(cases)('%s → %s', (number, expected) => {
    expect(matchInvoice(number, PRIZES_11507)).toBe(expected);
  });

  it('增開六獎:末 3 碼命中且不與頭獎尾 3 碼重疊', () => {
    const prizes = { ...PRIZES_11507, extraNumbers: ['733'] };
    expect(matchInvoice('QQ99999733', prizes)).toBe('extraSixth');
  });

  it('獎金表(分)', () => {
    expect(PRIZE_AMOUNTS_CENTS.super).toBe(1_000_000_000);
    expect(PRIZE_AMOUNTS_CENTS.first).toBe(20_000_000);
    expect(PRIZE_AMOUNTS_CENTS.sixth).toBe(20_000);
    expect(PRIZE_AMOUNTS_CENTS.extraSixth).toBe(20_000);
  });

  it('totalPrizeCents 只計該期', () => {
    const invoices: Invoice[] = [
      { id: '1', term: '11507', number: 'EF54348835', note: '', createdAt: 1 },
      { id: '2', term: '11507', number: 'OP99999835', note: '', createdAt: 2 },
      { id: '3', term: '11509', number: 'EF54348835', note: '', createdAt: 3 },
    ];
    expect(totalPrizeCents(invoices, PRIZES_11507)).toBe(20_000_000 + 20_000);
  });
});

describe('公告頁解析', () => {
  const FIXTURE = `
    <html><body><div class="content">
      <table><tr><td>特別獎 89996565 同期統一發票收執聯8位數號碼與特別獎號碼相同者獎金1,000萬元</td></tr>
      <tr><td>特獎 91098182 同期統一發票收執聯8位數號碼與特獎號碼相同者獎金200萬元</td></tr>
      <tr><td>頭獎 54348835 44991397 06595111 同期統一發票收執聯8位數號碼與頭獎號碼相同者獎金20萬元</td></tr>
      <tr><td>六獎 同期統一發票收執聯末3 位數號碼與 頭獎中獎號碼末3 位相同者各得獎金2百元</td></tr>
      <tr><td>增開六獎 733 890 各得獎金2百元</td></tr>
    </table></body></html>
  `;

  it('解析特別獎/特獎/頭獎三組/增開六獎', () => {
    const prizes = parsePrizeHtml(FIXTURE, '11507', 42);
    expect(prizes).toEqual({
      term: '11507',
      superNumber: '89996565',
      specialNumber: '91098182',
      firstNumbers: ['54348835', '44991397', '06595111'],
      extraNumbers: ['733', '890'],
      fetchedAt: 42,
    });
  });

  it('無增開六獎段 → 空陣列(11507 期實例)', () => {
    const html = FIXTURE.replace('<tr><td>增開六獎 733 890 各得獎金2百元</td></tr>', '');
    expect(parsePrizeHtml(html, '11507', 0)?.extraNumbers).toEqual([]);
  });

  it('缺必要欄位 → null', () => {
    expect(parsePrizeHtml('<html>沒有號碼</html>', '11507')).toBeNull();
    expect(parsePrizeHtml('<html>特別獎 89996565 特獎 91098182</html>', '11507')).toBeNull();
  });
});
