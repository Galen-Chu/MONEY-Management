/** 帳戶分頁測試(RNTL):點帳戶卡 → 明細 Sheet(本月收支+交易列+編輯帳戶鈕)。 */
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../../../i18n';
import AccountsScreen from '../accounts';
import type { Txn } from '../../../domain/ledger';
import { InMemoryAccountRepository, InMemoryTxnRepository } from '../../../data/repository';
import { __resetForTest as resetLedger, useLedgerStore } from '../../../state/ledgerStore';

void i18n;

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function txn(p: Partial<Txn>): Txn {
  return {
    id: 't1', date: '2026-11-20', type: 'expense', amountCents: 250, category: 'food',
    accountId: 'a1', toAccountId: null, note: '午餐', createdAt: 1, updatedAt: 1, ...p,
  };
}

function seed(txns: Txn[]) {
  resetLedger();
  const account = { id: 'a1', name: '現金', type: 'cash' as const, initialCents: 0, createdAt: 1 };
  useLedgerStore.getState().attach(new InMemoryAccountRepository([account]), new InMemoryTxnRepository());
  useLedgerStore.setState({ accounts: [account], txns });
}

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <AccountsScreen />
    </SafeAreaProvider>
  );
}

describe('AccountsScreen 帳戶明細', () => {
  it('點帳戶卡 → 明細含餘額、本月收支與交易列、編輯帳戶鈕', async () => {
    seed([
      txn({ id: '1', note: '午餐', amountCents: 250 }),
      txn({ id: '2', type: 'income', category: 'salary', amountCents: 50_000_00, note: '薪資' }),
      txn({ id: '3', accountId: 'a2', note: '別的帳戶' }),
    ]);
    const { getByText, getAllByText, queryByText, findByText } = await renderScreen();
    expect(getAllByText('現金').length).toBeGreaterThanOrEqual(1); // 名稱+類型標籤同字

    fireEvent.press(getAllByText('現金')[0]!);
    expect(await findByText(/餘額/)).toBeTruthy(); // 副標「類型 · 餘額: NT$…」
    expect(getAllByText(/NT\$49,997\.5/).length).toBeGreaterThanOrEqual(2); // 卡片餘額+明細副標(+收支摘要等)
    expect(getByText('午餐')).toBeTruthy();
    expect(getByText('薪資')).toBeTruthy();
    expect(queryByText('別的帳戶')).toBeNull(); // 他帳戶交易不出現
    expect(getByText('編輯帳戶')).toBeTruthy();
  });

  it('無交易 → 空狀態文案', async () => {
    seed([]);
    const { getAllByText, findByText } = await renderScreen();
    fireEvent.press(getAllByText('現金')[0]!);
    expect(await findByText('此帳戶還沒有交易')).toBeTruthy();
  });
});
