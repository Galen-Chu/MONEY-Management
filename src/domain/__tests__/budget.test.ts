/** 分類月預算測試:驗證、用量(80% 提醒/超支)、某月某分類支出、彙總與排序。 */
import {
  budgetUsage,
  budgetUsages,
  categorySpentCents,
  totalBudgetUsage,
  validateBudget,
  type Budget,
} from '../budget';
import type { Txn } from '../ledger';

function txn(date: string, category: Txn['category'], amountCents: number, type: Txn['type'] = 'expense'): Txn {
  return {
    id: `${date}-${category}-${amountCents}-${type}`, date, type, amountCents, category,
    accountId: 'a1', toAccountId: null, note: '', createdAt: 1, updatedAt: 1,
  };
}

describe('驗證', () => {
  it('支出分類+正整數金額', () => {
    expect(validateBudget('food', 100_000)).toBeNull();
    expect(validateBudget('salary', 100_000)).toBe('category'); // 收入分類不可設
    expect(validateBudget('food', 0)).toBe('amount');
    expect(validateBudget('food', 10.5)).toBe('amount');
    expect(validateBudget('food', -1)).toBe('amount');
  });
});

describe('用量', () => {
  it('80% 提醒、超支界線', () => {
    expect(budgetUsage(79_999, 100_000)).toMatchObject({ pct: 80, warning: true, over: false }); // 79.999→80
    expect(budgetUsage(50_000, 100_000)).toMatchObject({ pct: 50, warning: false, over: false });
    expect(budgetUsage(100_000, 100_000)).toMatchObject({ pct: 100, warning: true, over: false }); // 恰好用滿未超
    expect(budgetUsage(100_001, 100_000)).toMatchObject({ pct: 100, warning: true, over: true });
  });

  it('某月某分類支出:轉帳與收入不計、跨月不計', () => {
    const txns = [
      txn('2026-11-01', 'food', 1000),
      txn('2026-11-20', 'food', 500),
      txn('2026-11-21', 'food', 999, 'income'), // 非支出
      txn('2026-11-22', null, 800, 'transfer'), // 轉帳
      txn('2026-10-31', 'food', 7000), // 前月
      txn('2026-11-23', 'transport', 200), // 他分類
    ];
    expect(categorySpentCents('food', txns, '2026-11')).toBe(1500);
  });

  it('清單與彙總', () => {
    const budgets: Budget[] = [
      { category: 'food', amountCents: 100_000 },
      { category: 'transport', amountCents: 50_000 },
    ];
    const txns = [
      txn('2026-11-01', 'food', 90_000),
      txn('2026-11-02', 'transport', 60_000),
      txn('2026-11-03', 'fun', 999), // 無預算分類
    ];
    const list = budgetUsages(budgets, txns, '2026-11');
    expect(list.map((b) => b.category)).toEqual(['food', 'transport']); // 依支出降冪(90k > 60k)
    expect(list[0]).toMatchObject({ warning: true, over: false, pct: 90 });
    expect(list[1]).toMatchObject({ over: true, pct: 120 });

    const total = totalBudgetUsage(budgets, txns, '2026-11')!;
    expect(total).toMatchObject({ budgetCents: 150_000, spentCents: 150_000, pct: 100, over: false });
    expect(totalBudgetUsage([], txns, '2026-11')).toBeNull();
  });
});
