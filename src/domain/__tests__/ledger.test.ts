/** 記帳領域測試:餘額/淨值/月彙總/分類統計/依日分組/驗證/日期工具。 */
import type { Account, Txn, TxnInput } from '../ledger';
import {
  accountBalance,
  accountInUse,
  categoryTotals,
  groupByDate,
  monthTotals,
  netWorth,
  shiftDate,
  shiftMonth,
  todayKey,
  validDate,
  validateTxn,
} from '../ledger';

const ACC: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', initialCents: 100000, createdAt: 1 },
  { id: 'bank', name: '薪轉戶', type: 'bank', initialCents: 500000, createdAt: 2 },
  { id: 'card', name: '信用卡', type: 'credit', initialCents: 0, createdAt: 3 },
];

function txn(p: Partial<Txn>): Txn {
  return {
    id: 't1', date: '2026-10-01', type: 'expense', amountCents: 100,
    category: 'food', accountId: 'cash', toAccountId: null,
    note: '', createdAt: 1, updatedAt: 1, ...p,
  };
}

describe('帳戶餘額(D4:單一模型,信用卡轉負=負債)', () => {
  it('支出扣、收入加、轉帳一出一入', () => {
    const txns = [
      txn({ id: 'a', type: 'expense', amountCents: 2500, accountId: 'cash' }),
      txn({ id: 'b', type: 'income', amountCents: 400000, accountId: 'bank' }),
      txn({ id: 'c', type: 'transfer', amountCents: 50000, accountId: 'bank', toAccountId: 'cash', category: null }),
    ];
    expect(accountBalance(ACC[0]!, txns)).toBe(100000 - 2500 + 50000);
    expect(accountBalance(ACC[1]!, txns)).toBe(500000 + 400000 - 50000);
    expect(accountBalance(ACC[2]!, txns)).toBe(0);
  });

  it('信用卡消費讓餘額轉負;淨值=資產−負債', () => {
    const txns = [txn({ type: 'expense', amountCents: 30000, accountId: 'card' })];
    expect(accountBalance(ACC[2]!, txns)).toBe(-30000);
    const w = netWorth(ACC, txns);
    expect(w.assetsCents).toBe(600000);
    expect(w.debtsCents).toBe(30000);
    expect(w.netCents).toBe(570000);
  });
});

describe('月彙總與分類', () => {
  it('monthTotals:轉帳不計', () => {
    const txns = [
      txn({ type: 'expense', amountCents: 1000 }),
      txn({ id: '2', type: 'income', amountCents: 50000, category: 'salary', accountId: 'bank' }),
      txn({ id: '3', type: 'transfer', amountCents: 99999, accountId: 'bank', toAccountId: 'cash', category: null }),
    ];
    expect(monthTotals(txns)).toEqual({ incomeCents: 50000, expenseCents: 1000, netCents: 49000 });
  });

  it('categoryTotals:金額降冪、null 分類(轉帳)排除', () => {
    const txns = [
      txn({ type: 'expense', amountCents: 100, category: 'food' }),
      txn({ id: '2', type: 'expense', amountCents: 300, category: 'transport' }),
      txn({ id: '3', type: 'expense', amountCents: 200, category: 'food' }),
      txn({ id: '4', type: 'transfer', amountCents: 999, accountId: 'bank', toAccountId: 'cash', category: null }),
    ];
    const got = categoryTotals(txns);
    expect(got).toEqual([
      { category: 'food', amountCents: 300 }, // 100+200;與 transport 同額,穩定排序依插入序
      { category: 'transport', amountCents: 300 },
    ]);
  });
});

describe('依日分組', () => {
  it('日期降冪、組內 createdAt 升冪、當日收支合計', () => {
    const txns = [
      txn({ date: '2026-10-01', createdAt: 5, note: 'b' }),
      txn({ id: 'x', date: '2026-10-02', createdAt: 1, note: 'c' }),
      txn({ id: 'y', date: '2026-10-01', createdAt: 2, type: 'income', amountCents: 900, note: 'a' }),
    ];
    const groups = groupByDate(txns);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-02', '2026-10-01']);
    expect(groups[1]!.items.map((i) => i.note)).toEqual(['a', 'b']);
    expect(groups[1]!.expenseCents).toBe(100);
    expect(groups[1]!.incomeCents).toBe(900);
  });
});

describe('驗證', () => {
  const ok: TxnInput = {
    date: '2026-10-01', type: 'expense', amountCents: 100,
    category: 'food', accountId: 'cash', toAccountId: null, note: '',
  };

  it('合法輸入→null', () => {
    expect(validateTxn(ok, ACC)).toBeNull();
  });

  it('金額非正數/日期不合法', () => {
    expect(validateTxn({ ...ok, amountCents: 0 }, ACC)).toBe('amount');
    expect(validateTxn({ ...ok, amountCents: 10.5 }, ACC)).toBe('amount'); // 必須整數分
    expect(validateTxn({ ...ok, date: '2026-02-30' }, ACC)).toBe('date');
    expect(validateTxn({ ...ok, date: '2026/10/01' }, ACC)).toBe('date');
  });

  it('缺分類/帳戶不存在', () => {
    expect(validateTxn({ ...ok, category: null }, ACC)).toBe('category');
    expect(validateTxn({ ...ok, accountId: 'nope' }, ACC)).toBe('account');
  });

  it('轉帳:同帳戶拒絕、缺轉入拒絕、不限分類', () => {
    const tr: TxnInput = {
      date: '2026-10-01', type: 'transfer', amountCents: 100, category: null,
      accountId: 'cash', toAccountId: 'bank', note: '',
    };
    expect(validateTxn(tr, ACC)).toBeNull();
    expect(validateTxn({ ...tr, toAccountId: 'cash' }, ACC)).toBe('sameAccount');
    expect(validateTxn({ ...tr, toAccountId: null }, ACC)).toBe('account');
  });

  it('validDate/shiftDate/shiftMonth 跨界', () => {
    expect(validDate('2026-10-07')).toBe(true);
    expect(validDate('2026-13-01')).toBe(false);
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('帳戶引用檢查', () => {
  it('支出或轉入都算引用', () => {
    const txns = [
      txn({ accountId: 'cash' }),
      txn({ id: '2', type: 'transfer', accountId: 'bank', toAccountId: 'card', category: null }),
    ];
    expect(accountInUse('cash', txns)).toBe(true);
    expect(accountInUse('card', txns)).toBe(true);
    expect(accountInUse('bank', txns)).toBe(true);
  });
});
