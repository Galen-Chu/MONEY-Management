/**
 * 資產領域(P3):非帳戶資產(房地產/車輛/投資/保險/其他)與估值歷史——純函式。
 * 金額一律「分」整數(D2);估值帶日期,「當前值」= 日期(同年月日排序)最新的估值;
 * 淨值口徑(D4 擴充)= 帳戶淨值 + Σ資產估值 − Σ未償貸款 − 帳戶負餘額。
 */
import { netWorth, validDate, type Account, type Txn } from './ledger';
import { outstandingCents, type Loan } from './loan';

export type AssetType = 'real-estate' | 'vehicle' | 'investment' | 'insurance' | 'other';

export const ASSET_TYPES: readonly AssetType[] = ['real-estate', 'vehicle', 'investment', 'insurance', 'other'];

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  createdAt: number;
  updatedAt: number;
}

/** 單筆估值(資產某日的價值) */
export interface AssetValuation {
  id: string;
  assetId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 估值(分;≥0,0=報廢/出清) */
  valueCents: number;
  createdAt: number;
}

export type AssetErrorCode = 'name' | 'type';
export type ValuationErrorCode = 'value' | 'date';

export function validateAsset(name: string, type: AssetType): AssetErrorCode | null {
  if (!name.trim()) return 'name';
  if (!ASSET_TYPES.includes(type)) return 'type';
  return null;
}

export function validateValuation(valueCents: number, date: string): ValuationErrorCode | null {
  if (!Number.isInteger(valueCents) || valueCents < 0) return 'value';
  if (!validDate(date)) return 'date';
  return null;
}

/** 估值序列(日期升冪;同日以 createdAt 升冪) */
export function valueHistory(assetId: string, valuations: AssetValuation[]): AssetValuation[] {
  return valuations
    .filter((v) => v.assetId === assetId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

/** 該資產 asOf(含)當日以前的最新估值;無估值回 0 */
export function assetValueAt(assetId: string, valuations: AssetValuation[], asOf: string): number {
  const prior = valueHistory(assetId, valuations).filter((v) => v.date <= asOf);
  return prior.length ? prior[prior.length - 1]!.valueCents : 0;
}

/** Σ所有資產 asOn 估值 */
export function totalHoldingsCents(assets: Asset[], valuations: AssetValuation[], asOf: string): number {
  return assets.reduce((s, a) => s + assetValueAt(a.id, valuations, asOf), 0);
}

export interface FullNetWorth {
  accountAssetsCents: number; // 帳戶正餘額
  holdingsCents: number; // 資產估值
  totalAssetsCents: number;
  accountDebtsCents: number; // 信用卡等負餘額(絕對值)
  loanDebtsCents: number; // 貸款未償本金
  totalDebtsCents: number;
  netCents: number;
}

/** 完整淨值(帳戶+資產−負債) */
export function netWorthFull(
  accounts: Account[],
  txns: Txn[],
  loans: Loan[],
  assets: Asset[],
  valuations: AssetValuation[],
  asOf: string
): FullNetWorth {
  const base = netWorth(accounts, txns);
  const holdings = totalHoldingsCents(assets, valuations, asOf);
  const loanDebt = loans.reduce((s, l) => s + outstandingCents(l, asOf), 0);
  return {
    accountAssetsCents: base.assetsCents,
    holdingsCents: holdings,
    totalAssetsCents: base.assetsCents + holdings,
    accountDebtsCents: base.debtsCents,
    loanDebtsCents: loanDebt,
    totalDebtsCents: base.debtsCents + loanDebt,
    netCents: base.netCents + holdings - loanDebt,
  };
}

/** asOf(含)以前的帳戶餘額(歷史淨值用) */
function accountBalanceAt(account: Account, txns: Txn[], asOf: string): number {
  let b = account.initialCents;
  for (const t of txns) {
    if (t.date > asOf) continue;
    if (t.type !== 'transfer' && t.accountId === account.id) {
      b += t.type === 'income' ? t.amountCents : -t.amountCents;
    } else if (t.type === 'transfer') {
      if (t.accountId === account.id) b -= t.amountCents;
      else if (t.toAccountId === account.id) b += t.amountCents;
    }
  }
  return b;
}

/** 某日淨值(歷史趨勢用:帳戶依截至該日交易、資產取該日前最新估值、貸款取該日未償) */
export function netWorthAt(
  accounts: Account[],
  txns: Txn[],
  loans: Loan[],
  assets: Asset[],
  valuations: AssetValuation[],
  asOf: string
): number {
  let accountNet = 0;
  for (const a of accounts) {
    const b = accountBalanceAt(a, txns, asOf);
    accountNet += b;
  }
  return accountNet + totalHoldingsCents(assets, valuations, asOf) - loans.reduce((s, l) => s + outstandingCents(l, asOf), 0);
}

/** 近 count 個月的月末(asOf 當月以 asOf 計)淨值序列,升冪 */
export function netWorthTrend(
  accounts: Account[],
  txns: Txn[],
  loans: Loan[],
  assets: Asset[],
  valuations: AssetValuation[],
  asOf: string,
  count = 12
): Array<{ month: string; netCents: number }> {
  const ym = asOf.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const out: Array<{ month: string; netCents: number }> = [];
  for (let k = count - 1; k >= 0; k--) {
    const dt = new Date(y!, m! - 1 - k, 1);
    const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const isCurrent = month === ym;
    const day = isCurrent ? asOf : `${month}-${String(new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    out.push({ month, netCents: netWorthAt(accounts, txns, loans, assets, valuations, day) });
  }
  return out;
}
