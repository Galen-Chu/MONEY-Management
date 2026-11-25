/** 今天分頁測試(RNTL):月份導覽換月、備註搜尋跨月過濾、通知貼上解析→待確認→轉交易(以相對今日的動態日期,免時間脆性)。 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../../../i18n';
import TodayScreen from '../index';
import { monthOf, shiftMonth, todayKey, type Txn } from '../../../domain/ledger';
import { InMemoryAccountRepository, InMemoryNotificationDraftRepository, InMemoryTxnRepository } from '../../../data/repository';
import { __resetForTest, useLedgerStore } from '../../../state/ledgerStore';
import { __resetForTest as resetNotify, useNotificationStore } from '../../../state/notificationStore';
import { getStringAsync } from 'expo-clipboard';

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));

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
  resetNotify();
  useNotificationStore.getState().attach(new InMemoryNotificationDraftRepository());
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

describe('TodayScreen 通知管理(貼上解析)', () => {
  // 簡訊日期以今日動態組成(解析後落在本月,清單呈現免跨月脆性)
  const [, mo, dd] = todayKey().split('-');
  const SMS = `【台新銀行】您於${mo}/${dd} 14:05在統一超商消費,新台幣1,234元,卡號末4碼5678`;

  beforeEach(() => {
    (getStringAsync as unknown as jest.Mock).mockReset();
  });

  it('貼上解析:剪貼簿簡訊 → 待確認卡(商家/金額/卡號)', async () => {
    seed([]);
    (getStringAsync as unknown as jest.Mock).mockResolvedValue(SMS);
    const { getByLabelText, findByText, getByText } = await renderScreen();
    fireEvent.press(getByLabelText('貼上通知解析'));
    expect(await findByText('統一超商')).toBeTruthy();
    expect(getByText(/NT\$1,234/)).toBeTruthy();
    expect(getByText(/5678/)).toBeTruthy();
  });

  it('重複貼上 → 顯示重複提示、仍僅一張卡', async () => {
    seed([]);
    (getStringAsync as unknown as jest.Mock).mockResolvedValue(SMS);
    const { getByLabelText, findByText, findAllByText } = await renderScreen();
    fireEvent.press(getByLabelText('貼上通知解析'));
    await findByText('統一超商');
    fireEvent.press(getByLabelText('貼上通知解析'));
    expect(await findByText('這則通知已在待確認清單')).toBeTruthy();
    expect(await findAllByText('統一超商')).toHaveLength(1);
  });

  it('忽略 → 卡消失', async () => {
    seed([]);
    (getStringAsync as unknown as jest.Mock).mockResolvedValue(SMS);
    const { getByLabelText, findByText, getByText, queryByText } = await renderScreen();
    fireEvent.press(getByLabelText('貼上通知解析'));
    await findByText('統一超商');
    fireEvent.press(getByText('忽略'));
    await waitFor(() => expect(queryByText('統一超商')).toBeNull());
  });

  it('轉為交易:TxnSheet 預填(金額/備註)→ 儲存入帳且草稿移除', async () => {
    seed([]);
    (getStringAsync as unknown as jest.Mock).mockResolvedValue(SMS);
    const { getByLabelText, findAllByText, findByDisplayValue, findByText, getByText, queryByText } = await renderScreen();
    fireEvent.press(getByLabelText('貼上通知解析'));
    await findByText('統一超商');
    fireEvent.press(getByText('轉為交易'));
    expect(await findByDisplayValue('1234')).toBeTruthy(); // 金額(元)
    expect(await findByDisplayValue('統一超商')).toBeTruthy(); // 備註=商家
    fireEvent.press(getByText('儲存'));
    await waitFor(() => expect(queryByText('轉為交易')).toBeNull()); // 草稿卡移除
    expect((await findAllByText(/NT\$1,234/)).length).toBeGreaterThanOrEqual(1); // 交易入帳(月摘要/日小計/交易列)
  });
});
