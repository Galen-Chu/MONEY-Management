/** 帳戶明細領域測試:accountTxns(四端涵蓋)、accountMonthTotals(轉帳不計/跨月不計/他帳戶不計)。 */
import { accountMonthTotals, accountTxns, type Txn } from '../ledger';

function txn(p: Partial<Txn>): Txn {
  return {
    id: 't', date: '2026-11-10', type: 'expense', amountCents: 100, category: 'food',
    accountId: 'a1', toAccountId: null, note: '', createdAt: 1, updatedAt: 1, ...p,
  };
}

describe('accountTxns', () => {
  it('含支出/收入/轉出/轉入端;無關帳戶排除', () => {
    const txns = [
      txn({ id: '1', type: 'expense', accountId: 'a1' }),
      txn({ id: '2', type: 'income', accountId: 'a1' }),
      txn({ id: '3', type: 'transfer', accountId: 'a1', toAccountId: 'a2', category: null }),
      txn({ id: '4', type: 'transfer', accountId: 'a2', toAccountId: 'a1', category: null }),
      txn({ id: '5', type: 'expense', accountId: 'a2' }),
      txn({ id: '6', type: 'transfer', accountId: 'a2', toAccountId: 'a3', category: null }),
    ];
    expect(accountTxns(txns, 'a1').map((t) => t.id)).toEqual(['1', '2', '3', '4']);
    expect(accountTxns(txns, 'a3').map((t) => t.id)).toEqual(['6']);
  });
});

describe('accountMonthTotals', () => {
  it('轉帳不計、跨月不計、他帳戶不計', () => {
    const txns = [
      txn({ id: '1', date: '2026-11-01', type: 'expense', amountCents: 1000, accountId: 'a1' }),
      txn({ id: '2', date: '2026-11-02', type: 'income', amountCents: 5000, accountId: 'a1' }),
      txn({ id: '3', date: '2026-11-03', type: 'transfer', amountCents: 9999, accountId: 'a1', toAccountId: 'a2', category: null }),
      txn({ id: '4', date: '2026-10-31', type: 'expense', amountCents: 7000, accountId: 'a1' }),
      txn({ id: '5', date: '2026-11-04', type: 'expense', amountCents: 800, accountId: 'a2' }),
    ];
    expect(accountMonthTotals(txns, 'a1', '2026-11')).toEqual({
      incomeCents: 5000,
      expenseCents: 1000,
      netCents: 4000,
    });
  });
});
