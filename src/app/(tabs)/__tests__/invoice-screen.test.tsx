/** 發票分頁渲染測試(RNTL):中獎號碼卡、發票列與中獎徽章、總額。 */
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../../../i18n';
import InvoiceScreen from '../invoice';
import type { Invoice, PrizeNumbers } from '../../../domain/invoice';
import { InMemoryInvoiceRepository, InMemoryPrizeRepository } from '../../../data/repository';
import { __resetForTest, useInvoiceStore } from '../../../state/invoiceStore';

void i18n;

const PRIZES: PrizeNumbers = {
  term: '11507',
  superNumber: '89996565',
  specialNumber: '91098182',
  firstNumbers: ['54348835', '44991397', '06595111'],
  extraNumbers: [],
  fetchedAt: 1,
};

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function seed(invoices: Invoice[]) {
  __resetForTest();
  const prizeRepo = new InMemoryPrizeRepository();
  await prizeRepo.upsert(PRIZES);
  useInvoiceStore.getState().attach(new InMemoryInvoiceRepository(invoices), prizeRepo);
  await useInvoiceStore.getState().bootstrap();
  // 獎號直接入 state(分頁 loadPrizes 只在無快取時抓)
  useInvoiceStore.setState({ prizes: { '11507': PRIZES } });
}

describe('InvoiceScreen', () => {
  it('有發票與獎號:中獎號碼卡 + 發票號碼 + 中獎徽章與總額', async () => {
    const invoice: Invoice = { id: '1', term: '11507', number: 'EF54348835', note: '早餐店', createdAt: 1 };
    await seed([invoice, { id: '2', term: '11507', number: 'ZZ00000000', note: '', createdAt: 2 }]);
    const { getByText, getAllByText } = await render(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <InvoiceScreen initialTerm="11507" />
      </SafeAreaProvider>
    );
    expect(getByText('發票對獎')).toBeTruthy();
    expect(getByText(/89996565/)).toBeTruthy(); // 特別獎號
    expect(getByText('EF54348835')).toBeTruthy();
    expect(getAllByText('頭獎').length).toBeGreaterThanOrEqual(2); // 獎號卡列名 + 中獎徽章
    expect(getAllByText('NT$200,000').length).toBe(2); // 徽章金額 + 中獎總額
    expect(getByText('ZZ00000000')).toBeTruthy(); // 未中獎也在列
  });

  it('無發票 → 空狀態', async () => {
    await seed([]);
    const { getByText } = await render(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <InvoiceScreen initialTerm="11507" />
      </SafeAreaProvider>
    );
    expect(getByText('這期還沒有發票')).toBeTruthy();
  });
});
