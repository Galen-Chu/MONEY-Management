/**
 * 發票對獎 store(Zustand):發票號碼 CRUD + 獎號快取(fetch→本機 prize_numbers)。
 * 結構沿用 ledgerStore(guard 防護、驗證單一來源 domain.validateInvoice)。
 */
import { create } from 'zustand';

import {
  validateInvoice,
  type Invoice,
  type InvoiceTerm,
  type PrizeNumbers,
} from '../domain/invoice';
import { fetchPrizeNumbers, type HtmlFetcher } from '../data/prize-source';
import type { InvoiceRepository, PrizeRepository } from '../data/repository';
import { uid } from '../utils/uid';

interface InvoiceStore {
  loading: boolean;
  error: string | null;
  invoices: Invoice[];
  /** term → 獎號(本機快取) */
  prizes: Record<string, PrizeNumbers>;
  prizeLoadingTerm: string | null;

  attach: (invoices: InvoiceRepository, prizes: PrizeRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  addInvoice: (number: string, term: InvoiceTerm, note: string) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<void>;

  /** 載入某期獎號(先進快取;無則抓取後入庫) */
  loadPrizes: (term: InvoiceTerm, fetcher?: HtmlFetcher) => Promise<void>;
}

let invoiceRepo: InvoiceRepository | null = null;
let prizeRepo: PrizeRepository | null = null;

async function guard<T>(set: (s: Partial<InvoiceStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  loading: false,
  error: null,
  invoices: [],
  prizes: {},
  prizeLoadingTerm: null,

  attach: (invoices, prizes) => {
    invoiceRepo = invoices;
    prizeRepo = prizes;
  },

  bootstrap: async () => {
    const ir = invoiceRepo;
    const pr = prizeRepo;
    if (!ir || !pr) return;
    await guard(set, async () => {
      set({ loading: true });
      const invoices = await ir.list();
      set({ invoices, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  addInvoice: async (number, term, note) => {
    if (validateInvoice(number, term)) return false;
    return (await guard(set, async () => {
      if (!invoiceRepo) return false;
      const invoice: Invoice = { id: uid(), term, number, note: note.trim(), createdAt: Date.now() };
      await invoiceRepo.insert(invoice);
      set((s) => ({ invoices: [invoice, ...s.invoices] }));
      return true;
    })) ?? false;
  },

  deleteInvoice: async (id) => {
    await guard(set, async () => {
      if (!invoiceRepo) return;
      await invoiceRepo.remove(id);
      set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
    });
  },

  loadPrizes: async (term, fetcher) => {
    if (get().prizes[term]) return;
    set({ prizeLoadingTerm: term });
    await guard(set, async () => {
      const pr = prizeRepo;
      if (!pr) return;
      const cachedRow = await pr.get(term);
      if (cachedRow) {
        set((s) => ({ prizes: { ...s.prizes, [term]: cachedRow } }));
        return;
      }
      const fetched = await fetchPrizeNumbers(term, fetcher);
      await pr.upsert(fetched);
      set((s) => ({ prizes: { ...s.prizes, [term]: fetched } }));
    });
    set({ prizeLoadingTerm: null });
  },
}));

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  invoiceRepo = null;
  prizeRepo = null;
  useInvoiceStore.setState({ loading: false, error: null, invoices: [], prizes: {}, prizeLoadingTerm: null });
}
