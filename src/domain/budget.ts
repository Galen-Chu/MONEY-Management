/**
 * 分類月預算領域(優化候選,純函式):預算模型/驗證/用量計算(支出分類、月度口徑)。
 * 預算為「每月固定額」(不分年月);用量=該月該分類支出(轉帳不計,D4)。
 */
import { EXPENSE_CATEGORIES, type CategoryKey } from './categories';
import { monthOf, type Txn } from './ledger';

export interface Budget {
  category: CategoryKey;
  /** 每月預算(分;恆正) */
  amountCents: number;
}

export type BudgetErrorCode = 'category' | 'amount';

/** 驗證:分類需為支出分類、金額整數 > 0 */
export function validateBudget(category: CategoryKey, amountCents: number): BudgetErrorCode | null {
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return 'category';
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'amount';
  return null;
}

export interface BudgetUsage {
  budgetCents: number;
  spentCents: number;
  /** 使用率(%;四捨五入) */
  pct: number;
  /** ≥80% 提醒 */
  warning: boolean;
  /** 超支 */
  over: boolean;
}

export function budgetUsage(spentCents: number, budgetCents: number): BudgetUsage {
  const pct = budgetCents > 0 ? Math.round((spentCents / budgetCents) * 100) : 0;
  return {
    budgetCents,
    spentCents,
    pct,
    warning: pct >= 80,
    over: spentCents > budgetCents,
  };
}

/** 某月某分類支出(分) */
export function categorySpentCents(category: CategoryKey, txns: Txn[], month: string): number {
  return txns.reduce(
    (s, t) => (t.type === 'expense' && t.category === category && monthOf(t.date) === month ? s + t.amountCents : s),
    0
  );
}

/** 有設預算的分類之用量(依金額降冪;未設預算者不出現) */
export function budgetUsages(
  budgets: Budget[],
  txns: Txn[],
  month: string
): Array<BudgetUsage & { category: CategoryKey; spentCents: number }> {
  return budgets
    .map((b) => ({ category: b.category, ...budgetUsage(categorySpentCents(b.category, txns, month), b.amountCents) }))
    .sort((a, b) => b.spentCents - a.spentCents);
}

/** 全部預算彙總(本月總預算 vs 總支出) */
export function totalBudgetUsage(budgets: Budget[], txns: Txn[], month: string): BudgetUsage | null {
  if (budgets.length === 0) return null;
  const budgetCents = budgets.reduce((s, b) => s + b.amountCents, 0);
  const spentCents = budgets.reduce((s, b) => s + categorySpentCents(b.category, txns, month), 0);
  return budgetUsage(spentCents, budgetCents);
}
