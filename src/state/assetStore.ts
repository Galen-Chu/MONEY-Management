/**
 * 資產 store(Zustand):資產 CRUD(新增時寫入首筆估值)+ 估值歷史追加。
 * 結構沿用 ledgerStore(guard 防護、驗證單一來源 domain.validateAsset/validateValuation)。
 */
import { create } from 'zustand';

import {
  validateAsset,
  validateValuation,
  type Asset,
  type AssetType,
  type AssetValuation,
} from '../domain/asset';
import { todayKey } from '../domain/ledger';
import type { AssetRepository, ValuationRepository } from '../data/repository';
import { uid } from '../utils/uid';

interface AssetStore {
  loading: boolean;
  error: string | null;
  assets: Asset[];
  valuations: AssetValuation[];

  attach: (assets: AssetRepository, valuations: ValuationRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  addAsset: (name: string, type: AssetType, initialValueCents: number) => Promise<boolean>;
  updateAsset: (id: string, name: string, type: AssetType) => Promise<boolean>;
  deleteAsset: (id: string) => Promise<void>;
  addValuation: (assetId: string, valueCents: number, date: string) => Promise<boolean>;
}

let assetRepo: AssetRepository | null = null;
let valuationRepo: ValuationRepository | null = null;

async function guard<T>(set: (s: Partial<AssetStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  loading: false,
  error: null,
  assets: [],
  valuations: [],

  attach: (assets, valuations) => {
    assetRepo = assets;
    valuationRepo = valuations;
  },

  bootstrap: async () => {
    const ar = assetRepo;
    const vr = valuationRepo;
    if (!ar || !vr) return;
    await guard(set, async () => {
      set({ loading: true });
      const [assets, valuations] = await Promise.all([ar.list(), vr.listAll()]);
      set({ assets, valuations, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  addAsset: async (name, type, initialValueCents) => {
    if (validateAsset(name, type)) return false;
    if (validateValuation(initialValueCents, todayKey())) return false;
    return (await guard(set, async () => {
      if (!assetRepo || !valuationRepo) return false;
      const now = Date.now();
      const asset: Asset = { id: uid(), name: name.trim(), type, createdAt: now, updatedAt: now };
      await assetRepo.insert(asset);
      const valuation: AssetValuation = {
        id: uid(),
        assetId: asset.id,
        date: todayKey(),
        valueCents: initialValueCents,
        createdAt: now,
      };
      await valuationRepo.insert(valuation);
      set((s) => ({ assets: [...s.assets, asset], valuations: [...s.valuations, valuation] }));
      return true;
    })) ?? false;
  },

  updateAsset: async (id, name, type) => {
    if (validateAsset(name, type)) return false;
    return (await guard(set, async () => {
      if (!assetRepo) return false;
      const prev = get().assets.find((a) => a.id === id);
      if (!prev) return false;
      const next: Asset = { ...prev, name: name.trim(), type, updatedAt: Date.now() };
      await assetRepo.update(next);
      set((s) => ({ assets: s.assets.map((a) => (a.id === id ? next : a)) }));
      return true;
    })) ?? false;
  },

  deleteAsset: async (id) => {
    await guard(set, async () => {
      if (!assetRepo || !valuationRepo) return;
      await valuationRepo.removeByAsset(id);
      await assetRepo.remove(id);
      set((s) => ({
        assets: s.assets.filter((a) => a.id !== id),
        valuations: s.valuations.filter((v) => v.assetId !== id),
      }));
    });
  },

  addValuation: async (assetId, valueCents, date) => {
    if (validateValuation(valueCents, date)) return false;
    return (await guard(set, async () => {
      if (!valuationRepo) return false;
      const valuation: AssetValuation = { id: uid(), assetId, date, valueCents, createdAt: Date.now() };
      await valuationRepo.insert(valuation);
      set((s) => ({ valuations: [...s.valuations, valuation] }));
      return true;
    })) ?? false;
  },
}));

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  assetRepo = null;
  valuationRepo = null;
  useAssetStore.setState({ loading: false, error: null, assets: [], valuations: [] });
}
