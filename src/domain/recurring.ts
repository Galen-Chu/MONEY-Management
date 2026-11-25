/**
 * 定期交易領域(優化項,純函式):每月定期範本(房租/訂閱)+到期判定與草稿轉換。
 * 「必經確認」慣例:到期只產生待確認草稿,使用者按「確認」才真的入帳;
 * 「本月略過」與確認同樣記 lastHandledMonth,該月不再提示。
 */
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type CategoryKey } from './categories';
import { monthOf, validateTxn, type Account, type TxnInput, type TxnType } from './ledger';

export type RecurringType = Extract<TxnType, 'expense' | 'income'>;

export interface RecurringTxn {
  id: string;
  type: RecurringType;
  amountCents: number;
  category: CategoryKey;
  accountId: string;
  /** 每月几日(1-31;超過該月天數夾到月底) */
  dayOfMonth: number;
  note: string;
  /** 最後處置月份('YYYY-MM';確認或略過皆計)——同月不再提示 */
  lastHandledMonth: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RecurringInput {
  type: RecurringType;
  amountCents: number;
  category: CategoryKey;
  accountId: string;
  dayOfMonth: number;
  note: string;
}

export type RecurringErrorCode = 'amount' | 'category' | 'account' | 'day';

/** 驗證:金額>0、分類符合類型、帳戶存在、每月日 1-31 */
export function validateRecurring(input: RecurringInput, accounts: Account[]): RecurringErrorCode | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'amount';
  const cats: readonly string[] = input.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (!cats.includes(input.category)) return 'category';
  if (!accounts.some((a) => a.id === input.accountId)) return 'account';
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) return 'day';
  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 某月(month='YYYY-MM')的到期日;dayOfMonth 超過月底夾到底(31→2/28) */
export function dueDateOf(item: Pick<RecurringTxn, 'dayOfMonth'>, month: string): string {
  const [y, m] = month.split('-').map(Number);
  const day = Math.min(item.dayOfMonth, daysInMonth(y!, m!));
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** asOf 當月是否待處置:本月未處置 且 已到期(asOf ≥ 到期日) */
export function isDue(item: RecurringTxn, asOf: string): boolean {
  const month = monthOf(asOf);
  if (item.lastHandledMonth === month) return false;
  return asOf >= dueDateOf(item, month);
}

/** 轉為交易輸入(日期=當月到期日;驗證仍走 ledger.validateTxn 單一來源) */
export function toTxnInput(item: RecurringTxn, month: string, accounts: Account[]): TxnInput | null {
  const input: TxnInput = {
    date: dueDateOf(item, month),
    type: item.type,
    amountCents: item.amountCents,
    category: item.category,
    accountId: item.accountId,
    toAccountId: null,
    note: item.note.trim(),
  };
  return validateTxn(input, accounts) ? null : input;
}
