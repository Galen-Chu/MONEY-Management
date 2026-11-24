/**
 * 設計 token 單一事實來源:tokens.json(theme/index.ts 僅展開)。
 * 值同步自 Uniconsign(@galen-chu/uniconsign v0.2)語意層「淺色」——
 * 應用層命名對應:bg=bg.canvas(n50)、surface=bg.surface(n0)、sunken/track=bg.sunken(n100)、
 * ink=text.primary(n900)、inkSecondary=text.secondary(n600)、inkMuted=text.disabled(n400)、
 * onBrand=text.on-brand、accent=bg.brand(b600)、accentDeep=b700、accentSoft=brand-subtle(b50)、
 * line/trackAlt=border.default(n200)、scrim/shadow=n900、
 * income=success(b600)、expense/danger=red600、warning=y700、info=c600。
 * radius 對應 xl20/lg12/full;font.size 對應 xl22/md16/sm14/xs12。
 * 深色模式、Inter 字體與圖示匯入為後續工程項(見 docs/PLAN.md);套件依賴化前以此檔手動同步。
 */
import tokens from './tokens.json';

export const color = tokens.color as {
  bg: string; surface: string; sunken: string;
  ink: string; inkSecondary: string; inkMuted: string;
  onBrand: string; onBrandSecondary: string; onBrandSoft: string;
  line: string;
  accent: string; accentDeep: string; accentSoft: string;
  track: string; trackAlt: string; scrim: string; shadow: string;
  expense: string; income: string; danger: string; warning: string; info: string;
};

export const radius = tokens.radius as {
  card: number; row: number; button: number; chip: number; sheetTop: number;
};

export const font = tokens.font as {
  family: { regular: string; medium: string; semibold: string; bold: string };
  size: { title: number; h2: number; body: number; small: number; tiny: number };
};
