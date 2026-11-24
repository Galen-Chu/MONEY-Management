/** 資產領域測試:驗證、估值取值(asOf 前最新)、完整淨值組成、歷史淨值與趨勢。 */
import {
  assetValueAt,
  netWorthAt,
  netWorthFull,
  netWorthTrend,
  validateAsset,
  validateValuation,
  valueHistory,
  type Asset,
  type AssetValuation,
} from '../asset';
import type { Account, Txn } from '../ledger';
import { outstandingCents, type Loan } from '../loan';

const ASSET: Asset = { id: 'as1', name: '自住公寓', type: 'real-estate', createdAt: 1, updatedAt: 1 };

function valuation(date: string, valueCents: number, createdAt = 1, assetId = 'as1'): AssetValuation {
  return { id: `v-${date}-${valueCents}`, assetId, date, valueCents, createdAt };
}

describe('驗證', () => {
  it('資產:名稱必填、類型列舉', () => {
    expect(validateAsset('公寓', 'real-estate')).toBeNull();
    expect(validateAsset('  ', 'vehicle')).toBe('name');
    expect(validateAsset('車', 'weird' as Asset['type'])).toBe('type');
  });

  it('估值:整數 ≥ 0、日期合法', () => {
    expect(validateValuation(100, '2026-01-15')).toBeNull();
    expect(validateValuation(0, '2026-01-15')).toBeNull();
    expect(validateValuation(-1, '2026-01-15')).toBe('value');
    expect(validateValuation(1.5, '2026-01-15')).toBe('value');
    expect(validateValuation(100, '2026-02-30')).toBe('date');
  });
});

describe('估值取值', () => {
  const valuations = [
    valuation('2025-12-31', 10_000_000_00),
    valuation('2026-06-30', 11_000_000_00, 2),
    valuation('2026-06-30', 11_500_000_00, 3), // 同日較晚建立 → 最新
    valuation('2026-10-31', 12_000_000_00, 4),
  ];

  it('valueHistory:日期升冪、同日 createdAt 升冪', () => {
    expect(valueHistory('as1', valuations).map((v) => v.valueCents)).toEqual([
      10_000_000_00, 11_000_000_00, 11_500_000_00, 12_000_000_00,
    ]);
    expect(valueHistory('other', valuations)).toEqual([]);
  });

  it('assetValueAt:asOf 前最新;首筆估值前回 0', () => {
    expect(assetValueAt('as1', valuations, '2025-12-31')).toBe(10_000_000_00);
    expect(assetValueAt('as1', valuations, '2026-08-01')).toBe(11_500_000_00);
    expect(assetValueAt('as1', valuations, '2026-12-31')).toBe(12_000_000_00);
    expect(assetValueAt('as1', valuations, '2025-01-01')).toBe(0);
  });
});

describe('完整淨值', () => {
  const accounts: Account[] = [
    { id: 'a1', name: '現金', type: 'cash', initialCents: 100_000, createdAt: 1 },
    { id: 'a2', name: '卡', type: 'credit', initialCents: -20_000, createdAt: 2 },
  ];
  const txns: Txn[] = [];
  const loans: Loan[] = [
    {
      id: 'l1', name: '房貸', type: 'mortgage', principalCents: 100_000_000,
      annualRateMilliPercent: 2000, termMonths: 240, startDate: '2026-01-15',
      method: 'annuity', graceMonths: 0, createdAt: 1, updatedAt: 1,
    },
  ];
  const valuations = [valuation('2026-01-20', 50_000_000_00)];

  it('netWorthFull:帳戶+持有−卡債−貸款', () => {
    const w = netWorthFull(accounts, txns, loans, [ASSET], valuations, '2026-03-01');
    const loanOut = outstandingCents(loans[0]!, '2026-03-01');
    expect(w.accountAssetsCents).toBe(100_000);
    expect(w.holdingsCents).toBe(50_000_000_00);
    expect(w.totalAssetsCents).toBe(5_000_100_000);
    expect(w.accountDebtsCents).toBe(20_000);
    expect(w.loanDebtsCents).toBe(loanOut);
    expect(w.netCents).toBe(100_000 - 20_000 + 50_000_000_00 - loanOut);
  });

  it('netWorthAt:依截至日交易計帳戶', () => {
    const tx: Txn[] = [
      {
        id: 't1', date: '2026-01-10', type: 'income', amountCents: 30_000, category: 'salary',
        accountId: 'a1', toAccountId: null, note: '', createdAt: 1, updatedAt: 1,
      },
    ];
    const before = netWorthAt(accounts, tx, [], [], [], '2026-01-05');
    const after = netWorthAt(accounts, tx, [], [], [], '2026-01-31');
    expect(after - before).toBe(30_000);
  });

  it('netWorthTrend:12 筆升冪、當月以 asOf 計', () => {
    const trend = netWorthTrend(accounts, txns, loans, [ASSET], valuations, '2026-11-24', 12);
    expect(trend).toHaveLength(12);
    expect(trend[0]!.month).toBe('2025-12');
    expect(trend[11]!.month).toBe('2026-11');
    // 估值 2026-01-20:2025-12 月末無持有;2026-01 月末已含(該期貸款未償=全額)
    expect(netWorthAt(accounts, txns, [], [ASSET], valuations, '2025-12-31')).toBe(80_000);
    expect(trend[1]!.netCents).toBe(80_000 + 50_000_000_00 - 100_000_000);
    expect(trend[11]!.netCents).toBe(netWorthAt(accounts, txns, loans, [ASSET], valuations, '2026-11-24'));
  });
});
