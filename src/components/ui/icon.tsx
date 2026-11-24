/**
 * Uniconsign 圖示元件:@galen-chu/uniconsign 的 24×24 圖示內嵌本檔
 * (原始 SVG 唯一來源;填色由 color prop 注入——等同 currentColor)。
 * 新增圖示:自 Uniconsign repo 複製 path/rect/circle,fill 改吃 prop。
 */
import type { ReactElement } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { color } from '../../theme';

export type IconName =
  | 'sun' // dao
  | 'ledger' // science
  | 'balance' // philosophy
  | 'dashboard' // science
  | 'typewriter' // science
  | 'envelope' // science
  | 'plus' // math
  | 'arrowLeft' // ui
  | 'arrowRight' // ui
  | 'close'; // ui

const ICONS: Record<IconName, (fill: string) => ReactElement> = {
  sun: (f) => (
    <>
      <Path d="M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10Zm0 2a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z" fill={f} />
      <Rect x={11} y={2.5} width={2} height={4} rx={1} fill={f} />
      <Rect x={11} y={17.5} width={2} height={4} rx={1} fill={f} />
      <Rect x={2.5} y={11} width={4} height={2} rx={1} fill={f} />
      <Rect x={17.5} y={11} width={4} height={2} rx={1} fill={f} />
      <Rect x={16.65} y={3.87} width={2} height={4.97} rx={1} transform="rotate(-135 17.65 6.35)" fill={f} />
      <Rect x={16.65} y={15.17} width={2} height={4.97} rx={1} transform="rotate(-45 17.65 17.65)" fill={f} />
      <Rect x={5.35} y={15.17} width={2} height={4.97} rx={1} transform="rotate(-45 6.35 17.65)" fill={f} />
      <Rect x={5.35} y={3.87} width={2} height={4.97} rx={1} transform="rotate(-45 6.35 6.35)" fill={f} />
    </>
  ),
  ledger: (f) => (
    <>
      <Path d="M6 4H18Q20 4 20 6V18Q20 20 18 20H6Q4 20 4 18V6Q4 4 6 4Z M6 6V18H18V6Z" fill={f} />
      <Rect x={7.5} y={8} width={9} height={2} rx={1} fill={f} />
      <Rect x={10.5} y={8} width={2} height={8} rx={1} fill={f} />
    </>
  ),
  balance: (f) => (
    <>
      <Rect x={11} y={4} width={2} height={15} rx={1} fill={f} />
      <Rect x={4} y={5} width={16} height={2} rx={1} fill={f} />
      <Rect x={3.5} y={5.65} width={2} height={8.71} rx={1} transform="rotate(26.57 4.5 10)" fill={f} />
      <Rect x={6.5} y={5.65} width={2} height={8.71} rx={1} transform="rotate(-26.57 7.5 10)" fill={f} />
      <Rect x={15.5} y={5.65} width={2} height={8.71} rx={1} transform="rotate(26.57 16.5 10)" fill={f} />
      <Rect x={18.5} y={5.65} width={2} height={8.71} rx={1} transform="rotate(-26.57 19.5 10)" fill={f} />
      <Path d="M3 13A3 3 0 0 0 9 13A1 1 0 0 1 7 13A1 1 0 0 1 5 13A1 1 0 0 1 3 13Z" fill={f} />
      <Path d="M15 13A3 3 0 0 0 21 13A1 1 0 0 1 19 13A1 1 0 0 1 17 13A1 1 0 0 1 15 13Z" fill={f} />
      <Rect x={8} y={19} width={8} height={2} rx={1} fill={f} />
    </>
  ),
  dashboard: (f) => (
    <>
      <Path d="M5.64 18.36A9 9 0 1 1 18.36 18.36A1 1 0 0 1 16.95 16.95A7 7 0 1 0 7.05 16.95A1 1 0 0 0 5.64 18.36Z" fill={f} />
      <Rect x={11} y={3.4} width={2} height={2.6} rx={1} fill={f} />
      <Rect x={11.7} y={5.79} width={2} height={9.99} rx={1} transform="rotate(30 12.7 10.79)" fill={f} />
      <Circle cx={12} cy={12} r={1.6} fill={f} />
    </>
  ),
  typewriter: (f) => (
    <>
      <Path d="M9.5 2.5H14.5Q16.5 2.5 16.5 4.5V7.5Q16.5 9.5 14.5 9.5H9.5Q7.5 9.5 7.5 7.5V4.5Q7.5 2.5 9.5 2.5Z M9.5 4.5V7.5H14.5V4.5Z" fill={f} />
      <Rect x={9.3} y={5.3} width={5.4} height={1.4} rx={0.7} fill={f} />
      <Path d="M5 10H19Q21 10 21 12V15Q21 17 19 17H5Q3 17 3 15V12Q3 10 5 10Z M5 12V15H19V12Z" fill={f} />
      <Circle cx={7.5} cy={13.5} r={0.9} fill={f} />
      <Circle cx={12} cy={13.5} r={0.9} fill={f} />
      <Circle cx={16.5} cy={13.5} r={0.9} fill={f} />
    </>
  ),
  envelope: (f) => (
    <>
      <Path d="M5 6H19Q21 6 21 8V16Q21 18 19 18H5Q3 18 3 16V8Q3 6 5 6Z M5 8V16H19V8Z" fill={f} />
      <Rect x={7} y={4.1} width={2} height={12.31} rx={1} transform="rotate(-50.91 8 10.25)" fill={f} />
      <Rect x={15} y={4.1} width={2} height={12.31} rx={1} transform="rotate(50.91 16 10.25)" fill={f} />
    </>
  ),
  plus: (f) => (
    <>
      <Rect x={11} y={4} width={2} height={16} rx={1} fill={f} />
      <Rect x={4} y={11} width={16} height={2} rx={1} fill={f} />
    </>
  ),
  arrowLeft: (f) => (
    <Path
      d="M4 12a1 1 0 0 1 1-1h11.586l-4.293-4.293a1 1 0 0 1 1.414-1.414l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414L16.586 13H5a1 1 0 0 1-1-1Z"
      transform="rotate(180 12 12)"
      fill={f}
    />
  ),
  arrowRight: (f) => (
    <Path
      d="M4 12a1 1 0 0 1 1-1h11.586l-4.293-4.293a1 1 0 0 1 1.414-1.414l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414L16.586 13H5a1 1 0 0 1-1-1Z"
      fill={f}
    />
  ),
  close: (f) => (
    <>
      <Rect x={11} y={3} width={2} height={18} rx={1} transform="rotate(45 12 12)" fill={f} />
      <Rect x={11} y={3} width={2} height={18} rx={1} transform="rotate(-45 12 12)" fill={f} />
    </>
  ),
};

export function Icon({ name, size = 24, fill = color.ink }: { name: IconName; size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICONS[name](fill)}
    </Svg>
  );
}
