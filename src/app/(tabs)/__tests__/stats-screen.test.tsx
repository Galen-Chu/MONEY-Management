/** 統計分頁測試(RNTL):收支淨三卡、分類列、預算摘要與超支、空狀態、月導覽(動態日期免時間脆性)。 */
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../../../i18n';
import StatsScreen from '../stats';
import { monthOf, shiftMonth, todayKey, type Txn } from '../../../domain/ledger';
import type { CategoryKey } from '../../../domain/categories';
import {
  InMemoryAccountRepository,
  InMemoryBudgetRepository,
  InMemoryTxnRepository,
} from '../../../data/repository';
import { __resetForTest, useLedgerStore } from '../../../state/ledgerStore';
import { __resetForTest as resetBudget, useBudgetStore } from '../../../state/budgetStore';
import { __resetForTest as resetAsset } from '../../../state/assetStore';
import { __resetForTest as resetLoan } from '../../../state/loanStore';

void i18n;

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function txn(p: Partial<Txn>): Txn {
  return {
    id: 't1', date: `${monthOf(todayKey())}-15`, type: 'expense', amountCents: 25_000, category: 'food',
    accountId: 'a1', toAccountId: null, note: '', createdAt: 1, updatedAt: 1, ...p,
  };
}

function seed(txns: Txn[], budgets: Array<{ category: CategoryKey; amountCents: number }> = []) {
  __resetForTest();
  resetBudget();
  resetAsset();
  resetLoan();
  const account = { id: 'a1', name: '現金', type: 'cash' as const, initialCents: 0, createdAt: 1 };
  useLedgerStore.getState().attach(new InMemoryAccountRepository([account]), new InMemoryTxnRepository());
  useLedgerStore.setState({ accounts: [account], txns });
  useBudgetStore.getState().attach(new InMemoryBudgetRepository());
  useBudgetStore.setState({ budgets });
}

async function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <StatsScreen />
    </SafeAreaProvider>
  );
}

describe('StatsScreen', () => {
  it('空狀態:無支出 → noData 文案、三卡為零', async () => {
    seed([]);
    const { getByText, getAllByText } = await renderScreen();
    expect(getByText('統計')).toBeTruthy();
    expect(getByText('這個月還沒有支出')).toBeTruthy();
    expect(getAllByText('NT$0').length).toBeGreaterThanOrEqual(3); // 收/支/淨三卡
  });

  it('收支淨三卡 + 分類列(金額正確)', async () => {
    seed([
      txn({ id: 'e1', type: 'expense', amountCents: 25_000, category: 'food' }),
      txn({ id: 'i1', type: 'income', amountCents: 500_000, category: 'salary' }),
      txn({ id: 't1', type: 'transfer', amountCents: 100_000, toAccountId: 'a2' }), // 轉帳不計
    ]);
    const { getByText, getAllByText } = await renderScreen();
    expect(getByText('-NT$250')).toBeTruthy(); // 支出卡(250.00 元)
    expect(getAllByText(/NT\$4,750/).length).toBeGreaterThanOrEqual(1); // 淨額卡(現金流列亦現)
    expect(getByText('餐飲')).toBeTruthy(); // 分類列(所得分類不出現於支出分類)
    expect(getByText('NT$250')).toBeTruthy();
  });

  it('預算摘要卡:用量/預算、超支提示;分類列同格式', async () => {
    seed([txn({ id: 'e1', amountCents: 25_000 })], [{ category: 'food', amountCents: 20_000 }]);
    const { getByText, getAllByText } = await renderScreen();
    expect(getByText('本月預算')).toBeTruthy();
    expect(getAllByText('NT$250 / NT$200').length).toBe(2); // 摘要卡 + 餐飲列
    expect(getByText('已超支')).toBeTruthy();
  });

  it('月導覽:切上月 → 顯示上月分類', async () => {
    const prev = shiftMonth(monthOf(todayKey()), -1);
    seed([txn({ id: 'p1', date: `${prev}-07`, note: '上月' })]);
    const { getByText, queryByText, findByText } = await renderScreen();
    expect(queryByText('餐飲')).toBeNull(); // 本月無支出
    fireEvent.press(getByText('‹'));
    expect(await findByText('餐飲')).toBeTruthy();
  });
});
