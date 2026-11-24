/** 貸款分頁渲染測試(RNTL):空狀態、摘要卡與貸款卡內容。 */
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../../../i18n';
import LoansScreen from '../loans';
import { outstandingCents, type Loan } from '../../../domain/loan';
import { todayKey } from '../../../domain/ledger';
import { formatCents } from '../../../domain/money';
import { InMemoryLoanRepository } from '../../../data/repository';
import { __resetForTest, useLoanStore } from '../../../state/loanStore';
import { currentLanguage, useSettings } from '../../../state/settings';

void i18n;

function seedLoan(p: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    name: '台新房貸',
    type: 'mortgage',
    principalCents: 8_000_000_000, // 800 萬元
    annualRateMilliPercent: 2185, // 2.185%
    termMonths: 360,
    startDate: '2020-01-15',
    method: 'annuity',
    graceMonths: 0,
    createdAt: 1,
    updatedAt: 1,
    ...p,
  };
}

/** 測試環境無原生量測,須提供 initialMetrics 否則 insets context 為 null */
const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <LoansScreen />
    </SafeAreaProvider>
  );
}

describe('LoansScreen', () => {
  it('無貸款 → 空狀態與摘要 0', async () => {
    __resetForTest();
    useLoanStore.getState().attach(new InMemoryLoanRepository());
    const { getByText, getAllByText } = await renderScreen();
    expect(getByText('貸款')).toBeTruthy();
    expect(getByText('還沒有貸款')).toBeTruthy();
    expect(getAllByText('NT$0').length).toBeGreaterThanOrEqual(2); // 總剩餘 + 每月應繳
  });

  it('有貸款 → 摘要總剩餘與貸款卡(名稱/類型/剩餘)', async () => {
    __resetForTest();
    const loan = seedLoan();
    useLoanStore.getState().attach(new InMemoryLoanRepository([loan]));
    await useLoanStore.getState().bootstrap();
    const { getByText, getAllByText } = await renderScreen();
    expect(getByText('台新房貸')).toBeTruthy();
    expect(getByText(/房貸 · 2\.185%/)).toBeTruthy();
    const lang = currentLanguage(useSettings.getState().settings);
    const expected = formatCents(outstandingCents(loan, todayKey()), lang);
    expect(getAllByText(expected).length).toBe(2); // 摘要總剩餘 + 貸款卡剩餘(單一貸款同值)
  });
});
