/** 資產分頁渲染測試(RNTL):總覽卡與資產卡(名稱/類型/估值)。 */
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../../../i18n';
import AssetsScreen from '../assets';
import type { Asset, AssetValuation } from '../../../domain/asset';
import { InMemoryAssetRepository, InMemoryValuationRepository } from '../../../data/repository';
import { __resetForTest, useAssetStore } from '../../../state/assetStore';
import { formatCents } from '../../../domain/money';
import { currentLanguage, useSettings } from '../../../state/settings';

void i18n;

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function seed(assets: Asset[], valuations: AssetValuation[]) {
  __resetForTest();
  useAssetStore.getState().attach(new InMemoryAssetRepository(assets), new InMemoryValuationRepository(valuations));
  useAssetStore.setState({ assets, valuations });
}

describe('AssetsScreen', () => {
  it('空狀態 + 總估值 0', async () => {
    seed([], []);
    const { getByText } = await render(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <AssetsScreen />
      </SafeAreaProvider>
    );
    expect(getByText('資產')).toBeTruthy();
    expect(getByText('還沒有資產')).toBeTruthy();
    expect(getByText('NT$0')).toBeTruthy();
  });

  it('資產卡:名稱/類型/目前估值;總覽=Σ估值', async () => {
    const a1: Asset = { id: 'as1', name: '自住公寓', type: 'real-estate', createdAt: 1, updatedAt: 1 };
    const a2: Asset = { id: 'as2', name: '美股帳戶', type: 'investment', createdAt: 2, updatedAt: 2 };
    const v1: AssetValuation = { id: 'v1', assetId: 'as1', date: '2026-01-31', valueCents: 10_000_000_00, createdAt: 1 };
    const v2: AssetValuation = { id: 'v2', assetId: 'as2', date: '2026-02-28', valueCents: 1_234_500, createdAt: 2 };
    seed([a1, a2], [v1, v2]);
    const { getByText } = await render(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <AssetsScreen />
      </SafeAreaProvider>
    );
    expect(getByText('自住公寓')).toBeTruthy();
    expect(getByText('房地產')).toBeTruthy();
    expect(getByText('美股帳戶')).toBeTruthy();
    expect(getByText('投資')).toBeTruthy();
    const lang = currentLanguage(useSettings.getState().settings);
    expect(getByText(formatCents(10_000_000_00, lang))).toBeTruthy(); // 公寓估值
    expect(getByText(formatCents(10_000_000_00 + 1_234_500, lang))).toBeTruthy(); // 總覽
  });
});
