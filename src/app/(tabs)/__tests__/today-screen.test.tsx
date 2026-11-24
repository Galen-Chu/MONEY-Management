/** 今天分頁測試(RNTL):月份導覽換月、備註搜尋跨月過濾(以相對今日的動態月份,免時間脆性)。 */
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../../../i18n';
import TodayScreen from '../index';
import { monthOf, shiftMonth, todayKey, type Txn } from '../../../domain/ledger';
import { InMemoryAccountRepository, InMemoryTxnRepository } from '../../../data/repository';
import { __resetForTest, useLedgerStore } from '../../../state/ledgerStore';

void i18n;

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function txn(p: Partial<Txn>): Txn {
  return {
    id: 't1', date: '2026-10-01', type: 'expense', amountCents: 250, category: 'food',
    accountId: 'a1', toAccountId: null, note: '', createdAt: 1, updatedAt: 1, ...p,
  };
}

function seed(txns: Txn[]) {
  __resetForTest();
  const account = { id: 'a1', name: '現金', type: 'cash' as const, initialCents: 0, createdAt: 1 };
  const txnRepo = new InMemoryTxnRepository();
  void txnRepo.insert; // attach 後由 store 寫入
  useLedgerStore.getState().attach(new InMemoryAccountRepository([account]), txnRepo);
  useLedgerStore.setState({
    accounts: [account],
    txns, // 直接入 state(渲染層測試不走非同步寫入)
  });
}

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <TodayScreen />
    </SafeAreaProvider>
  );
}

describe('TodayScreen', () => {
  it('月份導覽:按下上個月 → 顯示上月交易', async () => {
    const prev = shiftMonth(monthOf(todayKey()), -1);
    seed([txn({ id: 'p1', date: `${prev}-07`, note: '上月餐費' })]);
    const { getByLabelText, queryByText, findByText } = await renderScreen();
    expect(queryByText('上月餐費')).toBeNull(); // 當月看不到
    fireEvent.press(getByLabelText('上個月'));
    expect(await findByText('上月餐費')).toBeTruthy();
  });

  it('備註搜尋:跨月過濾', async () => {
    const prev = shiftMonth(monthOf(todayKey()), -1);
    seed([
      txn({ id: 'a', date: `${prev}-01`, note: '咖啡豆' }),
      txn({ id: 'b', date: `${monthOf(todayKey())}-02`, note: '午餐' }),
    ]);
    const { getByLabelText, findByText, queryByText } = await renderScreen();
    fireEvent.changeText(getByLabelText(/搜尋備註/), '咖啡');
    expect(await findByText('咖啡豆')).toBeTruthy();
    expect(queryByText('午餐')).toBeNull();
  });
});
