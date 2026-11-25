/**
 * 定期交易 store(Zustand):範本 CRUD + 「確認入帳/本月略過」(必經確認——不自動入帳)。
 * 確認走 ledgerStore.addTxn(驗證單一來源)成功後才記 lastHandledMonth。
 */
import { create } from 'zustand';

import {
  isDue,
  toTxnInput,
  validateRecurring,
  type RecurringErrorCode,
  type RecurringInput,
  type RecurringTxn,
} from '../domain/recurring';
import { monthOf, todayKey } from '../domain/ledger';
import type { RecurringRepository } from '../data/repository';
import { useLedgerStore } from './ledgerStore';
import { uid } from '../utils/uid';

interface RecurringStore {
  loading: boolean;
  error: string | null;
  items: RecurringTxn[];

  attach: (recurring: RecurringRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  addRecurring: (input: RecurringInput) => Promise<boolean>;
  updateRecurring: (id: string, input: RecurringInput) => Promise<boolean>;
  deleteRecurring: (id: string) => Promise<void>;

  /** 確認入帳:建立交易成功後記處置月;回 false=驗證/寫入失敗 */
  confirm: (id: string) => Promise<boolean>;
  /** 本月略過:僅記處置月 */
  skipThisMonth: (id: string) => Promise<void>;
  /** 待確認清單(今天) */
  pendingToday: () => RecurringTxn[];
}

let recurringRepo: RecurringRepository | null = null;

async function guard<T>(set: (s: Partial<RecurringStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

function errCode(input: RecurringInput): RecurringErrorCode | null {
  return validateRecurring(input, useLedgerStore.getState().accounts);
}

export const useRecurringStore = create<RecurringStore>((set, get) => ({
  loading: false,
  error: null,
  items: [],

  attach: (recurring) => {
    recurringRepo = recurring;
  },

  bootstrap: async () => {
    const rr = recurringRepo;
    if (!rr) return;
    await guard(set, async () => {
      set({ loading: true });
      const items = await rr.list();
      set({ items, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  addRecurring: async (input) => {
    if (errCode(input)) return false;
    return (await guard(set, async () => {
      if (!recurringRepo) return false;
      const now = Date.now();
      const item: RecurringTxn = { id: uid(), ...input, note: input.note.trim(), lastHandledMonth: null, createdAt: now, updatedAt: now };
      await recurringRepo.insert(item);
      set((s) => ({ items: [...s.items, item] }));
      return true;
    })) ?? false;
  },

  updateRecurring: async (id, input) => {
    if (errCode(input)) return false;
    return (await guard(set, async () => {
      if (!recurringRepo) return false;
      const prev = get().items.find((r) => r.id === id);
      if (!prev) return false;
      const next: RecurringTxn = { ...prev, ...input, note: input.note.trim(), updatedAt: Date.now() };
      await recurringRepo.update(next);
      set((s) => ({ items: s.items.map((r) => (r.id === id ? next : r)) }));
      return true;
    })) ?? false;
  },

  deleteRecurring: async (id) => {
    await guard(set, async () => {
      if (!recurringRepo) return;
      await recurringRepo.remove(id);
      set((s) => ({ items: s.items.filter((r) => r.id !== id) }));
    });
  },

  confirm: async (id) => {
    const item = get().items.find((r) => r.id === id);
    if (!item) return false;
    const month = monthOf(todayKey());
    const input = toTxnInput(item, month, useLedgerStore.getState().accounts);
    if (!input) return false;
    const ok = await useLedgerStore.getState().addTxn(input);
    if (!ok) return false;
    await guard(set, async () => {
      if (!recurringRepo) return;
      const next = { ...item, lastHandledMonth: month, updatedAt: Date.now() };
      await recurringRepo.update(next);
      set((s) => ({ items: s.items.map((r) => (r.id === id ? next : r)) }));
    });
    return true;
  },

  skipThisMonth: async (id) => {
    await guard(set, async () => {
      if (!recurringRepo) return;
      const item = get().items.find((r) => r.id === id);
      if (!item) return;
      const next = { ...item, lastHandledMonth: monthOf(todayKey()), updatedAt: Date.now() };
      await recurringRepo.update(next);
      set((s) => ({ items: s.items.map((r) => (r.id === id ? next : r)) }));
    });
  },

  pendingToday: () => {
    const asOf = todayKey();
    return get().items.filter((r) => isDue(r, asOf));
  },
}));

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  recurringRepo = null;
  useRecurringStore.setState({ loading: false, error: null, items: [] });
}
