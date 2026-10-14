/**
 * 分類(P0 決策 D3):固定分類集,不做 CRUD——label 走 i18n(`categories.*`),
 * 色票集中於此(theme 之外的唯一色彩例外:分類識別色,識別優先)。
 */
export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'housing',
  'shopping',
  'fun',
  'medical',
  'education',
  'other',
] as const;

export const INCOME_CATEGORIES = ['salary', 'bonus', 'invest', 'otherIncome'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type CategoryKey = ExpenseCategory | IncomeCategory;

/** 分類 → i18n key(對稱維護於 locales) */
export function categoryLabelKey(c: CategoryKey): string {
  return `categories.${c}`;
}

/** 分類識別色(UI 圓點/長條) */
export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  food: '#D9975C',
  transport: '#6D9DC5',
  housing: '#A88BC9',
  shopping: '#D97A6C',
  fun: '#5CA8A0',
  medical: '#7CB56B',
  education: '#C9A227',
  other: '#9A9484',
  salary: '#4E8A5F',
  bonus: '#6FAF87',
  invest: '#5B8FB9',
  otherIncome: '#8A8F7C',
};
