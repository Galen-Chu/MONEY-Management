/**
 * 記帳核心 store(Zustand):帳戶與交易 CRUD。
 * 依賴 Repository 介面(測試注入 InMemory;App 用 createRepositories)。
 * 資料操作以 guard() 防護:錯誤寫入 error 狀態(UI 橫幅呈現),不外拋
 * unhandled rejection——結構沿用 TIME-Management。
 * P0 資料量(個人帳本)全量載入;mutation 後以純函式重算派生視圖。
 */
import { Platform } from 'react-native';
import { create } from 'zustand';

import type {
  Account,
  AccountType,
  Txn,
  TxnInput,
} from '../domain/ledger';
import { accountInUse, validateTxn } from '../domain/ledger';
import type { AccountRepository, TxnRepository } from '../data/repository';
import { uid } from '../utils/uid';

interface LedgerStore {
  loading: boolean;
  error: string | null; // 最近一次資料操作錯誤(技術訊息;UI 顯示通用文案)
  accounts: Account[];
  txns: Txn[];

  attach: (accounts: AccountRepository, txns: TxnRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  addTxn: (input: TxnInput) => Promise<boolean>; // false = 驗證失敗(不寫入)
  updateTxn: (id: string, input: TxnInput) => Promise<boolean>;
  deleteTxn: (id: string) => Promise<void>;

  addAccount: (input: { name: string; type: AccountType; initialCents: number }) => Promise<boolean>;
  updateAccount: (id: string, input: { name: string; type: AccountType; initialCents: number }) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>; // false = 仍有交易引用
}

let accountRepo: AccountRepository | null = null;
let txnRepo: TxnRepository | null = null;

/** guard():錯誤→error 狀態;成功→回呼結果;一律收尾 loading */
async function guard<T>(set: (s: Partial<LedgerStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

function txnFromInput(input: TxnInput, now: number): Txn {
  return {
    id: uid(),
    ...input,
    note: input.note.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export const useLedgerStore = create<LedgerStore>((set, get) => ({
  loading: false,
  error: null,
  accounts: [],
  txns: [],

  attach: (accounts, txns) => {
    accountRepo = accounts;
    txnRepo = txns;
  },

  bootstrap: async () => {
    const ar = accountRepo;
    const tr = txnRepo;
    if (!ar || !tr) return;
    await guard(set, async () => {
      set({ loading: true });
      const [accounts, txns] = await Promise.all([ar.list(), tr.listAll()]);
      set({ accounts, txns, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  addTxn: async (input) => {
    const err = validateTxn(input, get().accounts);
    if (err) return false;
    return (await guard(set, async () => {
      if (!txnRepo) return false;
      const txn = txnFromInput(input, Date.now());
      await txnRepo.insert(txn);
      set((s) => ({ txns: [...s.txns, txn] }));
      return true;
    })) ?? false;
  },

  updateTxn: async (id, input) => {
    const err = validateTxn(input, get().accounts);
    if (err) return false;
    return (await guard(set, async () => {
      if (!txnRepo) return false;
      const prev = get().txns.find((t) => t.id === id);
      if (!prev) return false;
      const next: Txn = {
        ...prev,
        ...input,
        note: input.note.trim(),
        updatedAt: Date.now(),
      };
      await txnRepo.update(next);
      set((s) => ({ txns: s.txns.map((t) => (t.id === id ? next : t)) }));
      return true;
    })) ?? false;
  },

  deleteTxn: async (id) => {
    await guard(set, async () => {
      if (!txnRepo) return;
      await txnRepo.remove(id);
      set((s) => ({ txns: s.txns.filter((t) => t.id !== id) }));
    });
  },

  addAccount: async (input) => {
    if (!input.name.trim()) return false;
    return (await guard(set, async () => {
      if (!accountRepo) return false;
      const account: Account = {
        id: uid(),
        name: input.name.trim(),
        type: input.type,
        initialCents: input.initialCents,
        createdAt: Date.now(),
      };
      await accountRepo.insert(account);
      set((s) => ({ accounts: [...s.accounts, account] }));
      return true;
    })) ?? false;
  },

  updateAccount: async (id, input) => {
    if (!input.name.trim()) return false;
    return (await guard(set, async () => {
      if (!accountRepo) return false;
      const prev = get().accounts.find((a) => a.id === id);
      if (!prev) return false;
      const next: Account = { ...prev, name: input.name.trim(), type: input.type, initialCents: input.initialCents };
      await accountRepo.update(next);
      set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? next : a)) }));
      return true;
    })) ?? false;
  },

  deleteAccount: async (id) => {
    if (accountInUse(id, get().txns)) return false;
    return (await guard(set, async () => {
      if (!accountRepo) return false;
      await accountRepo.remove(id);
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
      return true;
    })) ?? false;
  },
}));

// 走查/debug 用:暴露 store 到 window(web only;限開發模式)
if (Platform.OS === 'web' && typeof globalThis !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (globalThis as unknown as Record<string, unknown>).__moneycareStore = useLedgerStore;
}

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  accountRepo = null;
  txnRepo = null;
  useLedgerStore.setState({ loading: false, error: null, accounts: [], txns: [] });
}
