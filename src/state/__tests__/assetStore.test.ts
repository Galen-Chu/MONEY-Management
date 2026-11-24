/** assetStore 測試(InMemory repos):資產 CRUD(含首筆估值)、估值追加、刪除連帶清理。 */
import { InMemoryAssetRepository, InMemoryValuationRepository } from '../../data/repository';
import { __resetForTest, useAssetStore } from '../assetStore';
import { valueHistory } from '../../domain/asset';
import { shiftDate, todayKey } from '../../domain/ledger';

async function setup() {
  __resetForTest();
  useAssetStore.getState().attach(new InMemoryAssetRepository(), new InMemoryValuationRepository());
}

describe('資產 CRUD', () => {
  it('新增 → 資產+首筆估值(今天);空名稱拒絕', async () => {
    await setup();
    expect(await useAssetStore.getState().addAsset('  ', 'vehicle', 100)).toBe(false);
    const ok = await useAssetStore.getState().addAsset('代步車', 'vehicle', 500_000_00);
    expect(ok).toBe(true);
    const s = useAssetStore.getState();
    expect(s.assets).toHaveLength(1);
    expect(s.assets[0]).toMatchObject({ name: '代步車', type: 'vehicle' });
    expect(s.valuations).toHaveLength(1);
    expect(s.valuations[0]).toMatchObject({ assetId: s.assets[0]!.id, valueCents: 500_000_00 });
  });

  it('更新名稱/類型;bootstrap 重新載入', async () => {
    await setup();
    await useAssetStore.getState().addAsset('股票', 'other', 1000);
    const id = useAssetStore.getState().assets[0]!.id;
    const ok = await useAssetStore.getState().updateAsset(id, '美股帳戶', 'investment');
    expect(ok).toBe(true);
    expect(useAssetStore.getState().assets[0]).toMatchObject({ name: '美股帳戶', type: 'investment' });
    await useAssetStore.getState().bootstrap();
    expect(useAssetStore.getState().assets[0]!.name).toBe('美股帳戶');
  });

  it('刪除資產 → 估值一併清除', async () => {
    await setup();
    await useAssetStore.getState().addAsset('公寓', 'real-estate', 100);
    const id = useAssetStore.getState().assets[0]!.id;
    await useAssetStore.getState().addValuation(id, 200, '2026-01-10');
    expect(useAssetStore.getState().valuations).toHaveLength(2);
    await useAssetStore.getState().deleteAsset(id);
    expect(useAssetStore.getState().assets).toHaveLength(0);
    expect(useAssetStore.getState().valuations).toHaveLength(0);
  });
});

describe('估值追加', () => {
  it('新增估值成為最新值;非法值/日期拒絕', async () => {
    await setup();
    await useAssetStore.getState().addAsset('公寓', 'real-estate', 100);
    const id = useAssetStore.getState().assets[0]!.id;
    expect(await useAssetStore.getState().addValuation(id, -5, '2026-01-10')).toBe(false);
    expect(await useAssetStore.getState().addValuation(id, 300, '2026-02-30')).toBe(false);
    // 追加估值日期取「今天+5 天」確保晚於首筆(首筆=今天)
    expect(await useAssetStore.getState().addValuation(id, 300, shiftDate(todayKey(), 5))).toBe(true);
    const history = valueHistory(id, useAssetStore.getState().valuations);
    expect(history.map((v) => v.valueCents)).toEqual([100, 300]);
  });
});

describe('guard 錯誤防護', () => {
  it('repo 拋錯 → error 狀態不外拋', async () => {
    __resetForTest();
    const bad = new InMemoryAssetRepository();
    bad.insert = async () => {
      throw new Error('disk full');
    };
    useAssetStore.getState().attach(bad, new InMemoryValuationRepository());
    await useAssetStore.getState().addAsset('公寓', 'real-estate', 100);
    expect(useAssetStore.getState().error).toBe('disk full');
    useAssetStore.getState().clearError();
    expect(useAssetStore.getState().error).toBeNull();
  });
});
