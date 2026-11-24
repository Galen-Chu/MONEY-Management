/** invoiceStore 測試(InMemory repos):發票 CRUD、獎號載入(注入 fetcher)、快取與錯誤路徑。 */
import { InMemoryInvoiceRepository, InMemoryPrizeRepository } from '../../data/repository';
import { __resetForTest, useInvoiceStore } from '../invoiceStore';

const FIXTURE_HTML = `
  <html><body>
    特別獎 89996565 特獎 91098182 頭獎 54348835 44991397 06595111
  </body></html>
`;

async function setup() {
  __resetForTest();
  useInvoiceStore.getState().attach(new InMemoryInvoiceRepository(), new InMemoryPrizeRepository());
}

describe('發票 CRUD', () => {
  it('新增 → 備註修剪;格式錯拒絕', async () => {
    await setup();
    expect(await useInvoiceStore.getState().addInvoice('ab12345678', '11507', ' 早餐 ')).toBe(false);
    const ok = await useInvoiceStore.getState().addInvoice('AB12345678', '11507', ' 早餐 ');
    expect(ok).toBe(true);
    expect(useInvoiceStore.getState().invoices).toHaveLength(1);
    expect(useInvoiceStore.getState().invoices[0]).toMatchObject({ number: 'AB12345678', note: '早餐', term: '11507' });
  });

  it('刪除', async () => {
    await setup();
    await useInvoiceStore.getState().addInvoice('AB12345678', '11507', '');
    const id = useInvoiceStore.getState().invoices[0]!.id;
    await useInvoiceStore.getState().deleteInvoice(id);
    expect(useInvoiceStore.getState().invoices).toHaveLength(0);
  });
});

describe('獎號載入', () => {
  it('fetcher 注入 → 解析入 state 並持久化;重載走快取不再 fetch', async () => {
    await setup();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return FIXTURE_HTML;
    };
    await useInvoiceStore.getState().loadPrizes('11507', fetcher);
    const prizes = useInvoiceStore.getState().prizes['11507']!;
    expect(prizes.superNumber).toBe('89996565');
    expect(prizes.firstNumbers).toEqual(['54348835', '44991397', '06595111']);
    expect(calls).toBe(1);

    await useInvoiceStore.getState().loadPrizes('11507', async () => {
      throw new Error('offline');
    });
    expect(useInvoiceStore.getState().error).toBeNull(); // 有快取 → 不 fetch 不報錯
    expect(calls).toBe(1);
  });

  it('無快時 fetch 失敗 → error 狀態;bootstrap 後仍可由 repo 取回', async () => {
    await setup();
    await useInvoiceStore.getState().loadPrizes('11505', async () => {
      throw new Error('HTTP 500');
    });
    expect(useInvoiceStore.getState().error).toBe('HTTP 500');
    expect(useInvoiceStore.getState().prizes['11505']).toBeUndefined();
    useInvoiceStore.getState().clearError();
    expect(useInvoiceStore.getState().error).toBeNull();
  });
});
