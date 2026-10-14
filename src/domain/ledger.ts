/**
 * 記帳領域核心(ARCHITECTURE §Data Model 的純函式層):
 * 餘額/淨值/月彙總/分類統計/依日分組/交易驗證——全部無副作用、可測。
 *
 * 模型(D4 決策):帳戶採單一餘額模型——
 *   餘額 = 期初 + 收入 − 支出 + 轉入 − 轉出
 * 信用卡以「消費讓餘額轉負」呈現為負債;淨值 = Σ(正餘額) − Σ|負餘額|。
 */
import type { CategoryKey } from './categories';

export type AccountType = 'cash' | 'bank' | 'credit';
export type TxnType = 'expense' | 'income' | 'transfer';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** 期初餘額(分;信用卡可為負) */
  initialCents: number;
  createdAt: number;
}

export interface Txn {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: TxnType;
  /** 恆正(分);方向由 type 決定 */
  amountCents: number;
  /** expense/income 必填;transfer 為 null */
  category: CategoryKey | null;
  /** expense/income:付款/入款帳戶;transfer:轉出帳戶 */
  accountId: string;
  /** transfer:轉入帳戶;其餘 null */
  toAccountId: string | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface TxnInput {
  date: string;
  type: TxnType;
  amountCents: number;
  category: CategoryKey | null;
  accountId: string;
  toAccountId: string | null;
  note: string;
}

/** 交易驗證錯誤碼(UI 對應 i18n key `txn.err*`) */
export type TxnErrorCode = 'amount' | 'date' | 'category' | 'account' | 'sameAccount';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d;
}

/** 依現有帳戶清單驗證交易輸入;合法回 null,否則回第一個錯誤碼 */
export function validateTxn(input: TxnInput, accounts: Account[]): TxnErrorCode | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'amount';
  if (!validDate(input.date)) return 'date';
  const ids = new Set(accounts.map((a) => a.id));
  if (input.type === 'transfer') {
    if (!input.toAccountId || !ids.has(input.accountId) || !ids.has(input.toAccountId)) return 'account';
    if (input.accountId === input.toAccountId) return 'sameAccount';
  } else {
    if (input.category == null) return 'category';
    if (!ids.has(input.accountId)) return 'account';
  }
  return null;
}

/** 帳戶餘額 = 期初 + 收入 − 支出 + 轉入 − 轉出(只掃與該帳戶相關的交易) */
export function accountBalance(account: Account, txns: Txn[]): number {
  let b = account.initialCents;
  for (const t of txns) {
    if (t.type !== 'transfer' && t.accountId === account.id) {
      b += t.type === 'income' ? t.amountCents : -t.amountCents;
    } else if (t.type === 'transfer') {
      if (t.accountId === account.id) b -= t.amountCents;
      else if (t.toAccountId === account.id) b += t.amountCents;
    }
  }
  return b;
}

export interface NetWorth {
  assetsCents: number;
  debtsCents: number; // 正值(負餘額取絕對值)
  netCents: number;
}

/** 淨值 = Σ正餘額 − Σ|負餘額|(資產與負債分列) */
export function netWorth(accounts: Account[], txns: Txn[]): NetWorth {
  let assets = 0;
  let debts = 0;
  for (const a of accounts) {
    const b = accountBalance(a, txns);
    if (b >= 0) assets += b;
    else debts -= b;
  }
  return { assetsCents: assets, debtsCents: debts, netCents: assets - debts };
}

/** YYYY-MM-DD → YYYY-MM */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** 今天(本地時區)的 YYYY-MM-DD */
export function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 日期位移(天);跨月/跨年正確 */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d! + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** 月份位移;delta=-1 → 上月,跨年正確 */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(y!, m! - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export interface MonthTotals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

/** 月收支(轉帳不計——它不改變淨值,只是位置移動) */
export function monthTotals(txns: Txn[]): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.type === 'income') income += t.amountCents;
    else if (t.type === 'expense') expense += t.amountCents;
  }
  return { incomeCents: income, expenseCents: expense, netCents: income - expense };
}

/** 依分類彙總(金額降冪;transfer 自然排除——category 為 null) */
export function categoryTotals(txns: Txn[]): Array<{ category: CategoryKey; amountCents: number }> {
  const map = new Map<CategoryKey, number>();
  for (const t of txns) {
    if (t.category == null) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amountCents);
  }
  return [...map.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export interface DayGroup {
  date: string;
  items: Txn[]; // 當日依 createdAt 升冪
  expenseCents: number;
  incomeCents: number;
}

/** 依日分組(日期降冪=最新在上;組內 createdAt 升冪) */
export function groupByDate(txns: Txn[]): DayGroup[] {
  const map = new Map<string, Txn[]>();
  for (const t of txns) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) => a.createdAt - b.createdAt),
      expenseCents: items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0),
      incomeCents: items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountCents, 0),
    }));
}

/** 帳戶是否有任何交易引用(刪除帳戶的前置檢查) */
export function accountInUse(accountId: string, txns: Txn[]): boolean {
  return txns.some(
    (t) => t.accountId === accountId || (t.toAccountId != null && t.toAccountId === accountId)
  );
}
