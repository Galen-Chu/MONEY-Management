/** 貸款領域測試:驗證、日期工具、攤還表(annuity/principal/寬限/零利率)、
 *  未償本金、下一期、試算(額外還本/利率情境)、淨值含貸款。
 *  golden 值以獨立公式手算:100 萬/年率 2%/240 期 → 月繳 5,058.83 元。 */
import {
  addMonths,
  monthlyPaymentTotalCents,
  netWorthWithLoans,
  nextPayment,
  outstandingCents,
  paidPeriods,
  scheduleOf,
  simulateExtraPrincipal,
  simulateRateChange,
  totalInterestCents,
  validateLoan,
  type Loan,
  type LoanInput,
} from '../loan';

const BASE: Loan = {
  id: 'l1',
  name: '房貸',
  type: 'mortgage',
  principalCents: 100_000_000, // 100 萬元
  annualRateMilliPercent: 2000, // 2%
  termMonths: 240,
  startDate: '2026-01-15',
  method: 'annuity',
  graceMonths: 0,
  createdAt: 1,
  updatedAt: 1,
};

function input(p: Partial<LoanInput>): LoanInput {
  return {
    name: '房貸',
    type: 'mortgage',
    principalCents: 100_000_000,
    annualRateMilliPercent: 2000,
    termMonths: 240,
    startDate: '2026-01-15',
    method: 'annuity',
    graceMonths: 0,
    ...p,
  };
}

describe('validateLoan', () => {
  it('合法輸入回 null', () => {
    expect(validateLoan(input({}))).toBeNull();
    expect(validateLoan(input({ annualRateMilliPercent: 0 }))).toBeNull(); // 無息可
    expect(validateLoan(input({ type: 'car', method: 'principal', graceMonths: 12 }))).toBeNull();
  });

  it('各欄位非法 → 對應錯誤碼(依序回第一個)', () => {
    expect(validateLoan(input({ name: '  ' }))).toBe('name');
    expect(validateLoan(input({ principalCents: 0 }))).toBe('principal');
    expect(validateLoan(input({ principalCents: 10.5 }))).toBe('principal');
    expect(validateLoan(input({ annualRateMilliPercent: -1 }))).toBe('rate');
    expect(validateLoan(input({ annualRateMilliPercent: 3_000_001 }))).toBe('rate');
    expect(validateLoan(input({ termMonths: 0 }))).toBe('term');
    expect(validateLoan(input({ termMonths: 601 }))).toBe('term');
    expect(validateLoan(input({ startDate: '2026-02-30' }))).toBe('startDate');
    expect(validateLoan(input({ startDate: '2026/01/15' }))).toBe('startDate');
    expect(validateLoan(input({ graceMonths: 240 }))).toBe('grace');
    expect(validateLoan(input({ graceMonths: -1 }))).toBe('grace');
  });
});

describe('addMonths(月末夾到底)', () => {
  it('閏年與平年', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('跨年與負位移', () => {
    expect(addMonths('2026-01-15', 13)).toBe('2027-02-15');
    expect(addMonths('2026-03-15', -2)).toBe('2026-01-15');
  });
});

describe('攤還表 · annuity(本息平均)', () => {
  const sch = scheduleOf(BASE);

  it('第一期月繳 golden:5,058.83 元;首期利息 = 剩餘×月率', () => {
    expect(sch[0]!.paymentCents).toBe(505_883);
    expect(sch[0]!.interestCents).toBe(166_667); // round(1e8 × 2000 / 1.2e6)
    expect(sch[0]!.principalCents).toBe(505_883 - 166_667);
    expect(sch[0]!.dueDate).toBe('2026-02-15');
  });

  it('結構不變式:總本金收回、末期歸零、本金單調、利息貼合公式', () => {
    expect(sch).toHaveLength(240);
    expect(sch.reduce((s, p) => s + p.principalCents, 0)).toBe(BASE.principalCents);
    expect(sch[239]!.remainingCents).toBe(0);
    for (let k = 1; k < sch.length; k++) {
      expect(sch[k]!.remainingCents).toBeLessThan(sch[k - 1]!.remainingCents);
    }
    // 每期利息 = round(前期 remaining × rmp / 1.2e6)(誤差 ≤ 1 分內的不變式:直接重算比對)
    for (let k = 0; k < sch.length; k++) {
      const prevRem = k === 0 ? BASE.principalCents : sch[k - 1]!.remainingCents;
      expect(sch[k]!.interestCents).toBe(Math.round((prevRem * BASE.annualRateMilliPercent) / 1_200_000));
    }
  });

  it('總利息落獨立試算區間(≈214,120 元)', () => {
    const total = totalInterestCents(sch);
    expect(total).toBeGreaterThan(21_410_000);
    expect(total).toBeLessThan(21_413_000);
  });
});

describe('攤還表 · principal(本金平均)', () => {
  const loan: Loan = { ...BASE, method: 'principal' };
  const sch = scheduleOf(loan);

  it('每期本金固定 4,166.67 元、末期收尾 416,587', () => {
    expect(sch[0]!.principalCents).toBe(416_667);
    expect(sch[100]!.principalCents).toBe(416_667);
    expect(sch[239]!.principalCents).toBe(416_587); // 1e8 − 239×416667 = 416587
    expect(sch.reduce((s, p) => s + p.principalCents, 0)).toBe(BASE.principalCents);
  });

  it('利息逐期遞減、月繳因此遞減', () => {
    expect(sch[1]!.interestCents).toBeLessThan(sch[0]!.interestCents);
    expect(sch[10]!.paymentCents).toBeLessThan(sch[9]!.paymentCents);
  });
});

describe('攤還表 · 寬限期與零利率', () => {
  it('寬限 36 期只繳息;第 37 期起月繳 golden 3,969.00… 元(399,690 分)', () => {
    const loan: Loan = { ...BASE, termMonths: 360, graceMonths: 36 };
    const sch = scheduleOf(loan);
    expect(sch).toHaveLength(360);
    for (let k = 0; k < 36; k++) {
      expect(sch[k]!.principalCents).toBe(0);
      expect(sch[k]!.paymentCents).toBe(sch[k]!.interestCents);
      expect(sch[k]!.remainingCents).toBe(BASE.principalCents);
    }
    expect(sch[36]!.paymentCents).toBe(399_690);
    expect(sch[359]!.remainingCents).toBe(0);
  });

  it('零利率 annuity:月繳 = 本金/期數、總利息 0', () => {
    const loan: Loan = { ...BASE, annualRateMilliPercent: 0 };
    const sch = scheduleOf(loan);
    expect(sch[0]!.paymentCents).toBe(416_667);
    expect(sch[0]!.interestCents).toBe(0);
    expect(totalInterestCents(sch)).toBe(0);
    expect(sch[239]!.remainingCents).toBe(0);
  });
});

describe('未償本金 / 下一期 / 已繳期數', () => {
  it('outstanding:起算前=全額、繳 k 期後遞減、結清後=0', () => {
    expect(outstandingCents(BASE, '2026-01-01')).toBe(100_000_000);
    const after2 = outstandingCents(BASE, '2026-03-15');
    expect(after2).toBe(100_000_000 - scheduleOf(BASE)[0]!.principalCents - scheduleOf(BASE)[1]!.principalCents);
    expect(outstandingCents(BASE, '2050-01-01')).toBe(0);
  });

  it('nextPayment:回 asOf 後第一期;已結清回 null', () => {
    const next = nextPayment(BASE, '2026-05-20');
    expect(next?.dueDate).toBe('2026-06-15');
    expect(next?.period).toBe(5);
    expect(nextPayment(BASE, '2046-01-01')?.period).toBe(240); // 末期 2046-01-15 尚未到期
    expect(nextPayment(BASE, '2046-02-01')).toBeNull(); // 最後一期之後 → 結清
  });

  it('paidPeriods 與 monthlyPaymentTotalCents', () => {
    expect(paidPeriods(BASE, '2026-03-15')).toBe(2);
    expect(monthlyPaymentTotalCents([BASE, { ...BASE, id: 'l2', principalCents: 50_000_000 }], '2026-01-31')).toBe(
      505_883 + scheduleOf({ ...BASE, principalCents: 50_000_000 })[0]!.paymentCents
    );
  });
});

describe('試算', () => {
  it('額外還本 20 萬(第 12 期):期數縮短、利息節省、本金含額外還本', () => {
    const r = simulateExtraPrincipal(BASE, 20_000_000, 12);
    expect(r.newTermMonths).toBeLessThan(r.baseTermMonths);
    expect(r.savedInterestCents).toBeGreaterThan(0);
    const alt = scheduleOf(BASE, { extraCents: 20_000_000, extraAtPeriod: 12 });
    expect(alt[11]!.principalCents).toBe(scheduleOf(BASE)[11]!.principalCents + 20_000_000);
    expect(alt.reduce((s, p) => s + p.principalCents, 0)).toBe(BASE.principalCents);
  });

  it('利率情境:升息 → 月繳與總利息增加;降息 → 減少', () => {
    const up = simulateRateChange(BASE, 3000, 13); // 2% → 3%
    expect(up.newMonthlyCents).toBeGreaterThan(up.oldMonthlyCents);
    expect(up.diffTotalCents).toBeGreaterThan(0);
    const down = simulateRateChange(BASE, 1000, 13); // 2% → 1%
    expect(down.diffTotalCents).toBeLessThan(0);
  });
});

describe('淨值含貸款', () => {
  it('淨值 = 帳戶淨值 − 未償本金;負債分列', () => {
    const accounts = [
      { id: 'a1', name: '現金', type: 'cash' as const, initialCents: 100_000, createdAt: 1 },
      { id: 'a2', name: '卡', type: 'credit' as const, initialCents: -20_000, createdAt: 2 },
    ];
    const w = netWorthWithLoans(accounts, [], [BASE], '2026-02-01');
    expect(w.assetsCents).toBe(100_000);
    expect(w.accountDebtsCents).toBe(20_000);
    expect(w.loanDebtsCents).toBe(outstandingCents(BASE, '2026-02-01'));
    expect(w.debtsCents).toBe(20_000 + outstandingCents(BASE, '2026-02-01'));
    expect(w.netCents).toBe(100_000 - 20_000 - outstandingCents(BASE, '2026-02-01'));
  });
});
