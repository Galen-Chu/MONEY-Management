/**
 * Settings store(Zustand + AsyncStorage persist)——語言 + 外觀(深色模式 P0.6 批次三);
 * 語言結構沿用 TIME-Management(手動選擇 > 預設 zh-TW,不跟隨系統);
 * 外觀預設跟隨系統(system/light/dark)。偏好設定非金融資料,D5 不受限。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import i18n, { DEFAULT_LANGUAGE, type Language } from '../i18n';

export type Appearance = 'system' | 'light' | 'dark';

export interface Settings {
  language: Language | null; // null = 未手動選擇 → DEFAULT_LANGUAGE
  /** 外觀(深色模式);預設 system 跟隨系統 */
  appearance: Appearance;
}

interface SettingsStore {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  setLanguage: (lang: Language) => void;
  setAppearance: (appearance: Appearance) => void;
}

const DEFAULTS: Settings = { language: null, appearance: 'system' };

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLanguage: (lang) => {
        void i18n.changeLanguage(lang);
        set((s) => ({ settings: { ...s.settings, language: lang } }));
      },
      setAppearance: (appearance) => set((s) => ({ settings: { ...s.settings, appearance } })),
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
