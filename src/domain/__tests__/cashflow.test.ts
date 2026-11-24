/** monthlyCashflow 測試:月份涵蓋(含 endMonth、無交易補 0)、跨年、轉帳不計、淨額。 */
import { monthlyCashflow, shiftMonth, todayKey, monthOf, type Txn } from '../ledger';

function txn(date: string, type: Txn['type'], amountCents: number): Txn {
  return {
    id: `${date}-${type}-${amountCents}`, date, type, amountCents,
    category: type === 'transfer' ? null : 'food', accountId: 'a1', toAccountId: null,
    note: '', createdAt: 1, updatedAt: 1,
  };
}

describe('monthlyCashflow', () => {
  it('近 3 個月(含 endMonth)、無交易補 0、升冪', () => {
    const end = '2026-03';
    const flow = monthlyCashflow(
      [txn('2026-02-05', 'expense', 1000), txn('2026-02-10', 'income', 5000), txn('2026-03-01', 'expense', 200)],
      end,
      3
    );
    expect(flow.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(flow[0]).toMatchObject({ incomeCents: 0, expenseCents: 0, netCents: 0 });
    expect(flow[1]).toMatchObject({ incomeCents: 5000, expenseCents: 1000, netCents: 4000 });
    expect(flow[2]).toMatchObject({ incomeCents: 0, expenseCents: 200, netCents: -200 });
  });

  it('範圍外月份不計;轉帳不計;跨年正確', () => {
    const end = '2026-01';
    const flow = monthlyCashflow(
      [
        txn('2025-12-31', 'income', 3000),
        txn('2025-01-20', 'expense', 9999), // 超出 12 個月窗(窗=2025-02 起)
        txn('2026-01-15', 'transfer', 8888), // 轉帳不計
      ],
      end,
      12
    );
    expect(flow).toHaveLength(12);
    expect(flow[0]!.month).toBe('2025-02');
    expect(flow.find((m) => m.month === '2025-12')).toMatchObject({ incomeCents: 3000 });
    expect(flow.find((m) => m.month === '2026-01')).toMatchObject({ incomeCents: 0, expenseCents: 0 });
    const total = flow.reduce((s, m) => s + m.expenseCents, 0);
    expect(total).toBe(0); // 9999 在窗外、轉帳不計
  });

  it('預設 12 個月、與 shiftMonth 對齊', () => {
    const now = monthOf(todayKey());
    const flow = monthlyCashflow([], now);
    expect(flow).toHaveLength(12);
    expect(flow[11]!.month).toBe(now);
    expect(flow[0]!.month).toBe(shiftMonth(now, -11));
  });
});
