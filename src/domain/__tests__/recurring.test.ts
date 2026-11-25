/** 定期交易測試:驗證、月底夾斷、到期判定(處置月/到期日)、草稿轉換(驗證單一來源)。 */
import {
  dueDateOf,
  isDue,
  toTxnInput,
  validateRecurring,
  type RecurringTxn,
} from '../recurring';
import type { Account } from '../ledger';

const ACCOUNTS: Account[] = [
  { id: 'a1', name: '現金', type: 'cash', initialCents: 0, createdAt: 1 },
  { id: 'a2', name: '薪轉戶', type: 'bank', initialCents: 0, createdAt: 2 },
];

function item(p: Partial<RecurringTxn> = {}): RecurringTxn {
  return {
    id: 'r1', type: 'expense', amountCents: 15_000_00, category: 'housing',
    accountId: 'a1', dayOfMonth: 5, note: '房租', lastHandledMonth: null,
    createdAt: 1, updatedAt: 1, ...p,
  };
}

describe('驗證', () => {
  const input = {
    type: 'expense' as const,
    amountCents: 100,
    category: 'housing' as const,
    accountId: 'a1',
    dayOfMonth: 5,
    note: '',
  };

  it('金額/分類/帳戶/每月日', () => {
    expect(validateRecurring(input, ACCOUNTS)).toBeNull();
    expect(validateRecurring({ ...input, amountCents: 0 }, ACCOUNTS)).toBe('amount');
    expect(validateRecurring({ ...input, category: 'salary' as const }, ACCOUNTS)).toBe('category'); // 收入分類×支出
    expect(validateRecurring({ ...input, accountId: 'nope' }, ACCOUNTS)).toBe('account');
    expect(validateRecurring({ ...input, dayOfMonth: 0 }, ACCOUNTS)).toBe('day');
    expect(validateRecurring({ ...input, dayOfMonth: 32 }, ACCOUNTS)).toBe('day');
  });

  it('收入類型走收入分類', () => {
    expect(validateRecurring({ ...input, type: 'income' as const, category: 'salary' as const }, ACCOUNTS)).toBeNull();
    expect(validateRecurring({ ...input, type: 'income' as const }, ACCOUNTS)).toBe('category');
  });
});

describe('到期日與到期判定', () => {
  it('dayOfMonth 超過月底夾到底(閏年)', () => {
    expect(dueDateOf({ dayOfMonth: 31 }, '2026-02')).toBe('2026-02-28');
    expect(dueDateOf({ dayOfMonth: 31 }, '2024-02')).toBe('2024-02-29');
    expect(dueDateOf({ dayOfMonth: 15 }, '2026-04')).toBe('2026-04-15');
    expect(dueDateOf({ dayOfMonth: 31 }, '2026-01')).toBe('2026-01-31');
  });

  it('isDue:到期前否、到期日當天是;處置後同月否、次月復活', () => {
    const r = item({ dayOfMonth: 5 });
    expect(isDue(r, '2026-11-01')).toBe(false); // 未到期
    expect(isDue(r, '2026-11-05')).toBe(true); // 當天
    expect(isDue({ ...r, lastHandledMonth: '2026-11' }, '2026-11-05')).toBe(false); // 已處置
    expect(isDue({ ...r, lastHandledMonth: '2026-11' }, '2026-12-05')).toBe(true); // 次月
    expect(isDue({ ...r, lastHandledMonth: '2026-11' }, '2026-12-04')).toBe(false); // 次月未到期
  });
});

describe('草稿轉換', () => {
  it('轉為 TxnInput(日期=當月到期日);帳戶已刪→null', () => {
    const input = toTxnInput(item(), '2026-11', ACCOUNTS);
    expect(input).toMatchObject({ date: '2026-11-05', type: 'expense', amountCents: 15_000_00, note: '房租' });
    expect(toTxnInput(item({ accountId: 'gone' }), '2026-11', ACCOUNTS)).toBeNull();
  });

  it('月底夾斷同步反映在交易日期', () => {
    expect(toTxnInput(item({ dayOfMonth: 31 }), '2026-02', ACCOUNTS)?.date).toBe('2026-02-28');
  });
});
