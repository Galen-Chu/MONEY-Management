/**
 * 通知管理 store(Zustand):「貼上解析」→ 待確認草稿;移除。
 * 必經確認——入帳不在本 store:草稿經 TxnSheet(validateTxn 單一來源)儲存成功後,
 * 由畫面 onSaved 回呼呼叫 removeDraft;「忽略」直接移除。皆不自動入帳。
 */
import { create } from 'zustand';

import { parseNotification, type NotificationDraft, type NotificationSource, type ParseErrorCode } from '../domain/notification';
import type { NotificationDraftRepository } from '../data/repository';
import { uid } from '../utils/uid';

export type NotificationAddErrorCode = ParseErrorCode | 'duplicate' | 'repo';

interface NotificationStore {
  loading: boolean;
  error: string | null;
  drafts: NotificationDraft[];

  attach: (drafts: NotificationDraftRepository) => void;
  bootstrap: () => Promise<void>;
  clearError: () => void;

  /** 貼上解析:解析成功且非重複 → 新草稿;失敗回錯誤碼(UI 對應 i18n) */
  addFromText: (text: string, source?: NotificationSource) => Promise<{ ok: true } | { ok: false; code: NotificationAddErrorCode }>;
  removeDraft: (id: string) => Promise<void>;
}

let draftRepo: NotificationDraftRepository | null = null;

async function guard<T>(set: (s: Partial<NotificationStore>) => void, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  loading: false,
  error: null,
  drafts: [],

  attach: (drafts) => {
    draftRepo = drafts;
  },

  bootstrap: async () => {
    const dr = draftRepo;
    if (!dr) return;
    await guard(set, async () => {
      set({ loading: true });
      const drafts = await dr.list();
      set({ drafts, loading: false });
    });
    set({ loading: false });
  },

  clearError: () => set({ error: null }),

  addFromText: async (text, source = 'sms') => {
    const parsed = parseNotification(text);
    if (!parsed.ok) return { ok: false, code: parsed.code };
    const trimmed = text.trim();
    if (get().drafts.some((d) => d.rawText === trimmed)) return { ok: false, code: 'duplicate' };
    const saved = await guard(set, async () => {
      if (!draftRepo) return null;
      const draft: NotificationDraft = { id: uid(), source, rawText: trimmed, ...parsed.parsed, createdAt: Date.now() };
      await draftRepo.insert(draft);
      set((s) => ({ drafts: [...s.drafts, draft] }));
      return draft;
    });
    return saved ? { ok: true } : { ok: false, code: 'repo' };
  },

  removeDraft: async (id) => {
    await guard(set, async () => {
      if (!draftRepo) return;
      await draftRepo.remove(id);
      set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) }));
    });
  },
}));

/** 測試用:清空 repo 引用與狀態 */
export function __resetForTest(): void {
  draftRepo = null;
  useNotificationStore.setState({ loading: false, error: null, drafts: [] });
}
