/**
 * 貸款 store(Zustand):CRUD——結構沿用 ledgerStore。
 * 驗證單一來源 domain.validateLoan;錯誤寫 error 狀態(ErrorBanner 合併呈現)不外拋。
 */
import { create } from 'zustand';

import type { Loan, LoanInput } from '../domain/loan';
import { validateLoan } from '../domain/loan';
import type { LoanRepository } from '../data/repository';
import { uid } from '../utils/uid';

interface LoanStore {
  loading: boolean;
  error: string | null;
  loans: Loan[];

  attach: (loans: LoanRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  addLoan: (input: LoanInput) => Promise<boolean>; // false = 驗證失敗(不寫入)
  updateLoan: (id: string, input: LoanInput) => Promise<boolean>;
  deleteLoan: (id: string) => Promise<void>;
}

let loanRepo: LoanRepository | null = null;

async function guard<T>(set: (s: Partial<LoanStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

export const useLoanStore = create<LoanStore>((set, get) => ({
  loading: false,
  error: null,
  loans: [],

  attach: (loans) => {
    loanRepo = loans;
  },

  bootstrap: async () => {
    const lr = loanRepo;
    if (!lr) return;
    await guard(set, async () => {
      set({ loading: true });
      const loans = await lr.list();
      set({ loans, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  addLoan: async (input) => {
    if (validateLoan(input)) return false;
    return (await guard(set, async () => {
      if (!loanRepo) return false;
      const now = Date.now();
      const loan: Loan = { id: uid(), ...input, name: input.name.trim(), createdAt: now, updatedAt: now };
      await loanRepo.insert(loan);
      set((s) => ({ loans: [...s.loans, loan] }));
      return true;
    })) ?? false;
  },

  updateLoan: async (id, input) => {
    if (validateLoan(input)) return false;
    return (await guard(set, async () => {
      if (!loanRepo) return false;
      const prev = get().loans.find((l) => l.id === id);
      if (!prev) return false;
      const next: Loan = { ...prev, ...input, name: input.name.trim(), updatedAt: Date.now() };
      await loanRepo.update(next);
      set((s) => ({ loans: s.loans.map((l) => (l.id === id ? next : l)) }));
      return true;
    })) ?? false;
  },

  deleteLoan: async (id) => {
    await guard(set, async () => {
      if (!loanRepo) return;
      await loanRepo.remove(id);
      set((s) => ({ loans: s.loans.filter((l) => l.id !== id) }));
    });
  },
}));

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  loanRepo = null;
  useLoanStore.setState({ loading: false, error: null, loans: [] });
}
