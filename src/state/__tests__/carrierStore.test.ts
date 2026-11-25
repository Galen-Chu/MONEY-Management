/** 載具 store:憑證存取驗證、同步(注入 golden fetcher)、同號同期去重、錯誤碼。 */
import { InMemoryCarrierSettingsRepository, InMemoryInvoiceRepository, InMemoryPrizeRepository } from '../../data/repository';
import type { CarrierFetcher } from '../../data/carrier-source';
import { __resetForTest as resetInvoice, useInvoiceStore } from '../invoiceStore';
import { __resetForTest, monthsOfTerm, useCarrierStore } from '../carrierStore';

function detail(invNum: string) {
  return { invNum, cardType: '3J0002', sellerName: '統一超商', amount: '45', invPeriod: '11507', invDate: { year: '115', month: '7', date: '20' } };
}

const makeFetcher = (details: unknown[]): CarrierFetcher => async () => ({ code: '200', details });

async function setup(appID = 'APP001') {
  __resetForTest();
  resetInvoice();
  useInvoiceStore.getState().attach(new InMemoryInvoiceRepository(), new InMemoryPrizeRepository());
  await useInvoiceStore.getState().bootstrap();
  const repo = new InMemoryCarrierSettingsRepository();
  useCarrierStore.getState().attach(repo);
  await useCarrierStore.getState().saveSettings({ cardType: '3J0002', cardNo: '/ABC.123', cardEncrypt: '9876', appID });
  return repo;
}

describe('monthsOfTerm', () => {
  it('期別 → 兩個日曆月(11507 → 2026-07/08)', () => {
    expect(monthsOfTerm('11507')).toEqual(['2026-07', '2026-08']);
    expect(monthsOfTerm('11501')).toEqual(['2026-01', '2026-02']);
  });
});

describe('carrierStore', () => {
  it('saveSettings:空號碼/驗證碼拒絕;成功寫入 repo', async () => {
    const repo = await setup();
    expect(
      await useCarrierStore.getState().saveSettings({ cardType: '1K0001', cardNo: ' ', cardEncrypt: '1', appID: '' })
    ).toBe(false);
    expect(
      await useCarrierStore.getState().saveSettings({ cardType: '1K0001', cardNo: '1234', cardEncrypt: '', appID: '' })
    ).toBe(false);
    expect(await repo.get()).toMatchObject({ cardType: '3J0002', cardNo: '/ABC.123', cardEncrypt: '9876' });
  });

  it('syncTerm:入庫 source=carrier;同號同期(跨月重複/再次同步)去重', async () => {
    await setup();
    const res1 = await useCarrierStore.getState().syncTerm('11507', makeFetcher([detail('EV54838339')]));
    expect(res1).toEqual({ ok: true, added: 1 }); // 兩個月回同一張 → 第二月去重
    const invoices = useInvoiceStore.getState().invoices;
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
      source: 'carrier',
      term: '11507',
      number: 'EV54838339',
      sellerName: '統一超商',
      amountCents: 4500,
      cardType: '3J0002',
    });
    const res2 = await useCarrierStore.getState().syncTerm('11507', makeFetcher([detail('EV54838339')]));
    expect(res2).toEqual({ ok: true, added: 0 });
    expect(useInvoiceStore.getState().invoices).toHaveLength(1);
  });

  it('syncTerm:不同發票各一張 → added 2;與手動輸入同號同期亦去重', async () => {
    await setup();
    const fetcher: CarrierFetcher = async (_u, params) => ({
      code: '200',
      details: params.startDate === '2026/07/01' ? [detail('EV54838339')] : [detail('OP11223344')],
    });
    const res = await useCarrierStore.getState().syncTerm('11507', fetcher);
    expect(res).toEqual({ ok: true, added: 2 });
    expect(useInvoiceStore.getState().invoices).toHaveLength(2);

    await useInvoiceStore.getState().addInvoice('EV54838339', '11507', '手動重複');
    const res3 = await useCarrierStore.getState().syncTerm('11507', makeFetcher([detail('EV54838339')]));
    expect(res3).toEqual({ ok: true, added: 0 });
  });

  it('未綁定 → noSettings;無 appID → noAppID', async () => {
    await setup('');
    expect(await useCarrierStore.getState().syncTerm('11507', makeFetcher([detail('EV54838339')]))).toEqual({
      ok: false,
      code: 'noAppID',
    });
    __resetForTest();
    expect(await useCarrierStore.getState().syncTerm('11507')).toEqual({ ok: false, code: 'noSettings' });
  });

  it('API code≠200 → api(錯誤訊息入 error 狀態)', async () => {
    await setup();
    const failing: CarrierFetcher = async () => ({ code: '500', msg: 'cardNo error' });
    expect(await useCarrierStore.getState().syncTerm('11507', failing)).toEqual({ ok: false, code: 'api' });
    expect(useCarrierStore.getState().error).toBe('cardNo error');
  });

  it('bootstrap:由 repo 載入憑證', async () => {
    const repo = await setup();
    __resetForTest();
    useCarrierStore.getState().attach(repo);
    await useCarrierStore.getState().bootstrap();
    expect(useCarrierStore.getState().settings).toMatchObject({ cardNo: '/ABC.123', appID: 'APP001' });
  });
});
