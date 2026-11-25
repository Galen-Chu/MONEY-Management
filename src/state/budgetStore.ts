/**
 * 預算 store(Zustand):支出分類月預算 upsert/remove。
 * 驗證單一來源 domain.validateBudget;guard 模式同其他 store。
 */
import { create } from 'zustand';

import { validateBudget, type Budget } from '../domain/budget';
import type { CategoryKey } from '../domain/categories';
import type { BudgetRepository } from '../data/repository';

interface BudgetStore {
  loading: boolean;
  error: string | null;
  budgets: Budget[];

  attach: (budgets: BudgetRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  setBudget: (category: CategoryKey, amountCents: number) => Promise<boolean>;
  removeBudget: (category: CategoryKey) => Promise<void>;
}

let budgetRepo: BudgetRepository | null = null;

async function guard<T>(set: (s: Partial<BudgetStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  loading: false,
  error: null,
  budgets: [],

  attach: (budgets) => {
    budgetRepo = budgets;
  },

  bootstrap: async () => {
    const br = budgetRepo;
    if (!br) return;
    await guard(set, async () => {
      set({ loading: true });
      const budgets = await br.list();
      set({ budgets, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  setBudget: async (category, amountCents) => {
    if (validateBudget(category, amountCents)) return false;
    return (await guard(set, async () => {
      if (!budgetRepo) return false;
      const budget: Budget = { category, amountCents };
      await budgetRepo.upsert(budget);
      set((s) => ({
        budgets: s.budgets.some((b) => b.category === category)
          ? s.budgets.map((b) => (b.category === category ? budget : b))
          : [...s.budgets, budget],
      }));
      return true;
    })) ?? false;
  },

  removeBudget: async (category) => {
    await guard(set, async () => {
      if (!budgetRepo) return;
      await budgetRepo.remove(category);
      set((s) => ({ budgets: s.budgets.filter((b) => b.category !== category) }));
    });
  },
}));

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  budgetRepo = null;
  useBudgetStore.setState({ loading: false, error: null, budgets: [] });
}
