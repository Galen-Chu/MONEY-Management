/**
 * 載具 store(Zustand):載具憑證(本機 carrier_settings,**不入備份**)+ 「同步本期」。
 * 同步 = 期別的兩個日曆月各查一次(carrierInvChk 同月限制)→ 正規化 → 與既有發票
 * 「同號同期」去重 → invoiceStore.addInvoice(驗證單一來源,source='carrier')。
 * fetcher 可注入:appID 核發前以 golden 回應開發測試(見 data/carrier-source)。
 */
import { create } from 'zustand';

import {
  CarrierApiError,
  fetchCarrierMonth,
  type CardType,
  type CarrierFetcher,
  type CarrierSettings,
} from '../data/carrier-source';
import type { CarrierSettingsRepository } from '../data/repository';
import { useInvoiceStore } from './invoiceStore';

export interface CarrierSettingsInput {
  cardType: CardType;
  cardNo: string;
  cardEncrypt: string;
  appID: string;
}

export type CarrierSyncCode = 'noSettings' | 'noAppID' | 'network' | 'api' | 'parse';
export type CarrierSyncResult = { ok: true; added: number } | { ok: false; code: CarrierSyncCode };

interface CarrierStore {
  loading: boolean;
  error: string | null;
  settings: (CarrierSettings & { updatedAt: number }) | null;
  syncing: boolean;
  /** 最近一次同步(顯示用) */
  lastSync: { term: string; added: number } | null;

  attach: (carrier: CarrierSettingsRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  /** 儲存憑證(cardNo/cardEncrypt 必填;appID 可後補,未填則同步回 noAppID) */
  saveSettings: (input: CarrierSettingsInput) => Promise<boolean>;
  /** 同步期別(兩個月);結果不外拋,UI 依 code 對應文案 */
  syncTerm: (term: string, fetcher?: CarrierFetcher) => Promise<CarrierSyncResult>;
}

let carrierRepo: CarrierSettingsRepository | null = null;

async function guard<T>(set: (s: Partial<CarrierStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

/** 期別 → 兩個日曆月('11507' → ['2026-07', '2026-08']) */
export function monthsOfTerm(term: string): string[] {
  const y = Number(term.slice(0, 3)) + 1911;
  const m = Number(term.slice(3, 5));
  return [`${y}-${String(m).padStart(2, '0')}`, `${y}-${String(m + 1).padStart(2, '0')}`];
}

export const useCarrierStore = create<CarrierStore>((set, get) => ({
  loading: false,
  error: null,
  settings: null,
  syncing: false,
  lastSync: null,

  attach: (carrier) => {
    carrierRepo = carrier;
  },

  bootstrap: async () => {
    const cr = carrierRepo;
    if (!cr) return;
    await guard(set, async () => {
      set({ loading: true });
      const settings = await cr.get();
      set({ settings, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  saveSettings: async (input) => {
    if (!input.cardNo.trim() || !input.cardEncrypt.trim()) return false;
    return (await guard(set, async () => {
      if (!carrierRepo) return false;
      const row: CarrierSettings & { updatedAt: number } = {
        cardType: input.cardType,
        cardNo: input.cardNo.trim(),
        cardEncrypt: input.cardEncrypt.trim(),
        appID: input.appID.trim(),
        updatedAt: Date.now(),
      };
      await carrierRepo.save(row);
      set({ settings: row });
      return true;
    })) ?? false;
  },

  syncTerm: async (term, fetcher) => {
    const s = get().settings;
    if (!s) return { ok: false, code: 'noSettings' };
    if (!s.appID) return { ok: false, code: 'noAppID' };
    set({ syncing: true });
    try {
      const seen = new Set(useInvoiceStore.getState().invoices.map((i) => `${i.term}/${i.number}`));
      let added = 0;
      for (const month of monthsOfTerm(term)) {
        const list = await fetchCarrierMonth(s, month, fetcher);
        for (const inv of list) {
          const key = `${inv.term}/${inv.number}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const ok = await useInvoiceStore.getState().addInvoice(inv.number, inv.term, '', {
            date: inv.date,
            sellerName: inv.sellerName,
            amountCents: inv.amountCents,
            cardType: inv.cardType,
          });
          if (ok) added++;
        }
      }
      set({ syncing: false, lastSync: { term, added } });
      return { ok: true, added };
    } catch (e) {
      set({ syncing: false, error: e instanceof Error ? e.message : String(e) });
      const code: CarrierSyncCode = e instanceof CarrierApiError ? e.code : 'network';
      return { ok: false, code };
    }
  },
}));

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  carrierRepo = null;
  useCarrierStore.setState({ loading: false, error: null, settings: null, syncing: false, lastSync: null });
}
