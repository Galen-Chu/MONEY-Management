/** 主題測試:雙盤 parity(鍵齊全/值合法/值相異)、Provider 深淺覆寫、無 Provider 預設淺色。 */
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { darkColors, lightColors, ThemeProvider, useColors, useThemeMode } from '../index';
import { useSettings } from '../../state/settings';

function Probe() {
  const c = useColors();
  const mode = useThemeMode();
  return <Text testID="probe">{`${mode}:${c.bg}`}</Text>;
}

describe('雙盤 parity', () => {
  it('深淺鍵一致、值皆為合法顏色字串(hex/rgba)', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
    for (const v of [...Object.values(lightColors), ...Object.values(darkColors)]) {
      expect(v).toMatch(/^#[0-9a-fA-F]{6}$|^rgba\(/);
    }
  });

  it('每鍵深淺值相異(成對盤非複製)', () => {
    const same = Object.keys(lightColors).filter(
      (k) => lightColors[k as keyof typeof lightColors] === darkColors[k as keyof typeof darkColors]
    );
    expect(same).toEqual([]);
  });
});

describe('ThemeProvider', () => {
  it('appearance=dark → 深色盤 + dark 模式', async () => {
    useSettings.setState({ settings: { language: null, appearance: 'dark' } });
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(getByTestId('probe').props.children).toBe(`dark:${darkColors.bg}`);
  });

  it('appearance=light → 淺色盤', async () => {
    useSettings.setState({ settings: { language: null, appearance: 'light' } });
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(getByTestId('probe').props.children).toBe(`light:${lightColors.bg}`);
  });

  it('無 Provider → 預設淺色(測試零改動相容)', async () => {
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('probe').props.children).toBe(`light:${lightColors.bg}`);
  });
});
