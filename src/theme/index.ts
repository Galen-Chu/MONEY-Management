/**
 * 設計 token 單一事實來源:tokens.json(theme/index.ts 僅展開)。
 */
import tokens from './tokens.json';

export const color = tokens.color as {
  bg: string; surface: string; ink: string; inkSecondary: string; inkMuted: string;
  line: string; accent: string; accentDeep: string; accentSoft: string;
  track: string; trackAlt: string; expense: string; income: string; danger: string;
};

export const radius = tokens.radius as {
  card: number; row: number; button: number; chip: number; sheetTop: number;
};

export const font = tokens.font as {
  size: { title: number; h2: number; body: number; small: number; tiny: number };
};
