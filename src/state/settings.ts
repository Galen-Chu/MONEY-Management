/**
 * Settings store(Zustand + AsyncStorage persist)——P0 僅語言;
 * 結構沿用 TIME-Management(手動選擇 > 預設 zh-TW,不跟隨系統)。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import i18n, { DEFAULT_LANGUAGE, type Language } from '../i18n';

export interface Settings {
  language: Language | null; // null = 未手動選擇 → DEFAULT_LANGUAGE
}

interface SettingsStore {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  setLanguage: (lang: Language) => void;
}

const DEFAULTS: Settings = { language: null };

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLanguage: (lang) => {
        void i18n.changeLanguage(lang);
        set((s) => ({ settings: { ...s.settings, language: lang } }));
      },
    }),
    {
      name: 'moneycare-settings',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        void i18n.changeLanguage(state?.settings.language ?? DEFAULT_LANGUAGE);
      },
    }
  )
);

/** 現行生效語言 */
export function currentLanguage(s: Settings): Language {
  return s.language ?? DEFAULT_LANGUAGE;
}
