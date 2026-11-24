/**
 * 貸款領域(P1,純計算零串接):模型/驗證/攤還表/未償本金/試算。
 * 金額一律「分」整數(D2);年利率以「千分之百分比」整數儲存(2.185% → 2185),
 * 期內利息 = round(期初剩餘本金(分) × rateMilliPercent ÷ 1,200,000)。
 * 攤還口徑:寬限期只繳息不還本;annuity=本息平均攤還(月繳固定,末期收尾)、
 * principal=本金平均攤還(每月本金固定);提前還本採「月繳不變、期數縮短」。
 */
import { netWorth, validDate, type Account, type Txn } from './ledger';

export type LoanType = 'mortgage' | 'car' | 'personal' | 'student' | 'other';
export type LoanMethod = 'annuity' | 'principal';

export const LOAN_TYPES: readonly LoanType[] = ['mortgage', 'car', 'personal', 'student', 'other'];
export const LOAN_METHODS: readonly LoanMethod[] = ['annuity', 'principal'];

export interface Loan {
  id: string;
  name: string;
  type: LoanType;
  /** 核貸本金(分;恆正) */
  principalCents: number;
  /** 年利率(千分之百分比;2.185% = 2185;0 = 無息) */
  annualRateMilliPercent: number;
  /** 總期數(月) */
  termMonths: number;
  /** 起算日(YYYY-MM-DD);第 k 期繳款日 = 起算日 + k 個月(月末夾到底) */
  startDate: string;
  method: LoanMethod;
  /** 寬限期(月;之後以剩餘期數攤還) */
  graceMonths: number;
  createdAt: number;
  updatedAt: number;
}

export interface LoanInput {
  name: string;
  type: LoanType;
  principalCents: number;
  annualRateMilliPercent: number;
  termMonths: number;
  startDate: string;
  method: LoanMethod;
  graceMonths: number;
}

/** 貸款驗證錯誤碼(UI 對應 i18n key `loan.err*`) */
export type LoanErrorCode = 'name' | 'principal' | 'rate' | 'term' | 'startDate' | 'grace';

/** 驗證貸款輸入;合法回 null,否則回第一個錯誤碼 */
export function validateLoan(input: LoanInput): LoanErrorCode | null {
  if (!input.name.trim()) return 'name';
  if (!Number.isInteger(input.principalCents) || input.principalCents <= 0) return 'principal';
  if (
    !Number.isInteger(input.annualRateMilliPercent) ||
    input.annualRateMilliPercent < 0 ||
    input.annualRateMilliPercent > 2_000_000 // 上限 2000% 防呆
  ) {
    return 'rate';
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 600) return 'term';
  if (!validDate(input.startDate)) return 'startDate';
  if (!Number.isInteger(input.graceMonths) || input.graceMonths < 0 || input.graceMonths >= input.termMonths) {
    return 'grace';
  }
  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 月份位移(保持「日」;超過月底夾到月底,2024-01-31 +1 → 2024-02-29) */
export function addMonths(date: string, k: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const total = y! * 12 + (m! - 1) + k;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d!, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

export interface LoanPeriod {
  period: number; // 1..termMonths
  dueDate: string; // YYYY-MM-DD
  paymentCents: number; // 當期應繳總額(息+本;含額外還本)
  interestCents: number;
  principalCents: number; // 當期償還本金(含額外還本)
  remainingCents: number; // 繳完本期後剩餘本金
}

export interface ScheduleOpts {
  /** 額外還本(分):第 extraAtPeriod 期繳款時一併償還 */
  extraCents?: number;
  extraAtPeriod?: number;
}

/** 完整攤還表(純函式;提前還本→月繳不變、期數自然縮短) */
export function scheduleOf(loan: Loan, opts: ScheduleOpts = {}): LoanPeriod[] {
  const { graceMonths: grace, termMonths: n } = loan;
  const rmp = loan.annualRateMilliPercent;
  const i = rmp / 1_200_000;
  const nEff = n - grace;
  let pmt = 0;
  let basePrincipal = 0;
  if (loan.method === 'annuity') {
    pmt = i > 0
      ? Math.round((loan.principalCents * i) / (1 - Math.pow(1 + i, -nEff)))
      : Math.round(loan.principalCents / nEff);
  } else {
    basePrincipal = Math.round(loan.principalCents / nEff);
  }

  const periods: LoanPeriod[] = [];
  let remaining = loan.principalCents;
  for (let p = 1; p <= n && remaining > 0; p++) {
    const interest = Math.round((remaining * rmp) / 1_200_000);
    let principalPart: number;
    if (p <= grace) {
      principalPart = 0;
    } else if (loan.method === 'annuity') {
      // 末期強制結清:月繳為四捨五入常數,逐期利息捨入會累積數分殘留
      principalPart = p === n ? remaining : Math.max(0, Math.min(pmt - interest, remaining));
    } else {
      principalPart = Math.min(basePrincipal, remaining);
    }
    const extra =
      opts.extraCents != null && opts.extraCents > 0 && p === opts.extraAtPeriod
        ? Math.min(opts.extraCents, remaining - principalPart)
        : 0;
    remaining -= principalPart + extra;
    periods.push({
      period: p,
      dueDate: addMonths(loan.startDate, p),
      paymentCents: interest + principalPart + extra,
      interestCents: interest,
      principalCents: principalPart + extra,
      remainingCents: remaining,
    });
  }
  return periods;
}

/** 攤還表總利息 */
export function totalInterestCents(schedule: LoanPeriod[]): number {
  return schedule.reduce((s, p) => s + p.interestCents, 0);
}

/** asOf(含)前已到期各期償還後的未償本金 */
export function outstandingCents(loan: Loan, asOf: string): number {
  let remaining = loan.principalCents;
  for (const p of scheduleOf(loan)) {
    if (p.dueDate > asOf) break;
    remaining -= p.principalCents;
  }
  return Math.max(0, remaining);
}

/** 下一期應繳(asOf 後第一期);已結清回 null */
export function nextPayment(loan: Loan, asOf: string): LoanPeriod | null {
  return scheduleOf(loan).find((p) => p.dueDate > asOf) ?? null;
}

/** 已到期期數(含 asOf 當日) */
export function paidPeriods(loan: Loan, asOf: string): number {
  let paid = 0;
  for (const p of scheduleOf(loan)) {
    if (p.dueDate > asOf) break;
    paid++;
  }
  return paid;
}

/** 所有貸款「下一期」應繳總額(每月參考值) */
export function monthlyPaymentTotalCents(loans: Loan[], asOf: string): number {
  return loans.reduce((s, l) => s + (nextPayment(l, asOf)?.paymentCents ?? 0), 0);
}

/** 額外還本試算:atPeriod 期繳款時多還 extraCents(月繳不變 → 期數縮短) */
export function simulateExtraPrincipal(
  loan: Loan,
  extraCents: number,
  atPeriod: number
): {
  baseTotalInterestCents: number;
  newTotalInterestCents: number;
  savedInterestCents: number;
  baseTermMonths: number;
  newTermMonths: number;
} {
  const base = scheduleOf(loan);
  const alt = scheduleOf(loan, { extraCents, extraAtPeriod: atPeriod });
  const baseI = totalInterestCents(base);
  const altI = totalInterestCents(alt);
  return {
    baseTotalInterestCents: baseI,
    newTotalInterestCents: altI,
    savedInterestCents: baseI - altI,
    baseTermMonths: base.length,
    newTermMonths: alt.length,
  };
}

/** 利率情境:自 fromPeriod 期起改用新路利率(月繳重算、總期數不變) */
export function simulateRateChange(
  loan: Loan,
  newRateMilliPercent: number,
  fromPeriod: number
): {
  oldMonthlyCents: number;
  newMonthlyCents: number;
  oldTotalInterestCents: number;
  newTotalInterestCents: number;
  diffTotalCents: number;
} {
  const base = scheduleOf(loan);
  const oldI = totalInterestCents(base);
  // fromPeriod 前一期期末的剩餘本金 → 衍生新貸款(同剩餘期數、新利率)
  let remainingAt = loan.principalCents;
  for (const p of base) {
    if (p.period >= fromPeriod) break;
    remainingAt = p.remainingCents;
  }
  const derived: Loan = {
    ...loan,
    principalCents: remainingAt,
    termMonths: Math.max(1, loan.termMonths - (fromPeriod - 1)),
    graceMonths: Math.max(0, loan.graceMonths - (fromPeriod - 1)),
    annualRateMilliPercent: newRateMilliPercent,
    startDate: addMonths(loan.startDate, fromPeriod - 1),
  };
  const alt = scheduleOf(derived);
  const firstNonGrace = alt.find((p) => p.principalCents > 0) ?? alt[0]!;
  const oldFirst = base.find((p) => p.period >= fromPeriod && p.principalCents > 0) ?? base[0]!;
  // 新總利息 = 變動前的利息(不變)+ 新利率下剩餘期的利息
  const beforeI = base.filter((p) => p.period < fromPeriod).reduce((s, p) => s + p.interestCents, 0);
  const newI = beforeI + totalInterestCents(alt);
  return {
    oldMonthlyCents: oldFirst.paymentCents,
    newMonthlyCents: firstNonGrace.paymentCents,
    oldTotalInterestCents: oldI,
    newTotalInterestCents: newI,
    diffTotalCents: newI - oldI,
  };
}

/** 淨值含貸款(D4 擴充):帳戶負債 + 未償貸款本金 */
export function netWorthWithLoans(
  accounts: Account[],
  txns: Txn[],
  loans: Loan[],
  asOf: string
): {
  assetsCents: number;
  accountDebtsCents: number;
  loanDebtsCents: number;
  debtsCents: number;
  netCents: number;
} {
  const base = netWorth(accounts, txns);
  const loanDebt = loans.reduce((s, l) => s + outstandingCents(l, asOf), 0);
  return {
    assetsCents: base.assetsCents,
    accountDebtsCents: base.debtsCents,
    loanDebtsCents: loanDebt,
    debtsCents: base.debtsCents + loanDebt,
    netCents: base.netCents - loanDebt,
  };
}
