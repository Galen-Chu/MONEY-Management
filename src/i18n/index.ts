/**
 * i18next 單例。zh-TW 預設、en-US 完整第二語言;插值 {{param}};
 * 金額/日期一律 Intl(domain/money.ts、format.ts)。
 * 語言解析:Settings.language(手動設定)→ 預設 zh-TW(不跟隨系統——與
 * TIME-Management 同規:僅明確選擇才切換)。
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import zhTW from './locales/zh-TW.json';

export const SUPPORTED_LANGS = ['zh-TW', 'en-US'] as const;
export type Language = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANGUAGE: Language = 'zh-TW';

void i18next.use(initReactI18next).init({
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  resources: {
    'zh-TW': { translation: zhTW },
    'en-US': { translation: enUS },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18next;
