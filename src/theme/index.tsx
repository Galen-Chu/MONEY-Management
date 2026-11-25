/**
 * 設計 token 單一事實來源:tokens.json(本檔展開+執行期主題)。
 * 值同步自 Uniconsign(@galen-chu/uniconsign v0.2)語意層——淺色=既值、深色=$extensions.mode.dark
 * (2026-11-25 實讀 tokens/semantic.json)。應用層命名對應:
 * bg=bg.canvas(n50/n900)、surface=bg.surface(n0/n800)、sunken/track=bg.sunken(n100/n1000)、
 * ink=text.primary(n900/n50)、inkSecondary=text.secondary(n600/n300)、inkMuted=text.disabled(n400/n500)、
 * onBrand=text.on-brand(深色品牌面 b400 → 其上文字深 n900)、
 * accent=bg.brand(b600/b400)、accentDeep=b700/b300、accentSoft=brand-subtle(b50/b900)、
 * line/trackAlt=border.default(n200/n700)、scrim=overlay(黑 55%)、shadow=n900/黑、
 * income=success(b600/b400)、expense/danger=red600/red400、warning=y700/y400、info=c600/c400。
 * radius 對應 xl20/lg12/full;font.size 對應 xl22/md16/sm14/xs12。
 * 慣例:元件樣式一律 makeStyles(c) 工廠+useStyles(模組級禁止引用色票);radius/font 與模式無關維持靜態。
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import tokens from './tokens.json';
import { useSettings, type Appearance } from '../state/settings';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bg: string; surface: string; sunken: string;
  ink: string; inkSecondary: string; inkMuted: string;
  onBrand: string; onBrandSecondary: string; onBrandSoft: string;
  line: string;
  accent: string; accentDeep: string; accentSoft: string;
  track: string; trackAlt: string; scrim: string; shadow: string;
  expense: string; income: string; danger: string; warning: string; info: string;
}

export const lightColors = tokens.color as ThemeColors;
export const darkColors = tokens.colorDark as ThemeColors;

export const radius = tokens.radius as {
  card: number; row: number; button: number; chip: number; sheetTop: number;
};

export const font = tokens.font as {
  family: { regular: string; medium: string; semibold: string; bold: string };
  size: { title: number; h2: number; body: number; small: number; tiny: number };
};

interface ThemeCtx {
  c: ThemeColors;
  mode: ThemeMode;
}

/** 預設淺色——未掛 Provider 的測試/工具零改動 */
const Ctx = createContext<ThemeCtx>({ c: lightColors, mode: 'light' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings((s) => s.settings);
  const scheme = useColorScheme();
  const appearance: Appearance = settings.appearance ?? 'system';
  const mode: ThemeMode = appearance === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : appearance;
  const value = useMemo<ThemeCtx>(() => ({ c: mode === 'dark' ? darkColors : lightColors, mode }), [mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useColors(): ThemeColors {
  return useContext(Ctx).c;
}

export function useThemeMode(): ThemeMode {
  return useContext(Ctx).mode;
}

/** 元件樣式工廠掛鉤:const { c, styles } = useStyles(makeStyles) */
export function useStyles<T>(make: (c: ThemeColors) => T): { c: ThemeColors; styles: T } {
  const c = useColors();
  const styles = useMemo(() => make(c), [c, make]);
  return { c, styles };
}
