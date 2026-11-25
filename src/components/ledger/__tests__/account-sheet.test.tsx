/** AccountSheet 表單測試(RNTL):名稱/期初餘額驗證、信用卡負數期初、編輯預填、被引用擋刪(errInUse)。
 *  本環境 RNTL 為 async render——互動一律包進 await act(async ...) 序列化 act scope(實測教訓,見 txn-sheet 測試註)。 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';

import i18n from '../../../i18n';
import { AccountSheet } from '../account-sheet';
import type { Account, Txn } from '../../../domain/ledger';
import { InMemoryAccountRepository, InMemoryTxnRepository } from '../../../data/repository';
import { __resetForTest, useLedgerStore } from '../../../state/ledgerStore';

void i18n;

type AccountSheetProps = ComponentProps<typeof AccountSheet>;

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function seed(accounts: Account[], txns: Txn[] = []) {
  __resetForTest();
  useLedgerStore.getState().attach(new InMemoryAccountRepository(accounts), new InMemoryTxnRepository());
  useLedgerStore.setState({ accounts, txns });
}

async function press(el: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(el);
  });
}

async function type(el: Parameters<typeof fireEvent.changeText>[0], text: string) {
  await act(async () => {
    fireEvent.changeText(el, text);
  });
}

async function renderSheet(props: Partial<AccountSheetProps> = {}) {
  const onClose = jest.fn();
  const utils = await render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <AccountSheet visible onClose={onClose} initial={null} {...props} />
    </SafeAreaProvider>
  );
  return { ...utils, onClose };
}

describe('AccountSheet 驗證', () => {
  it('名稱空 → errName;期初非數字 → errAmount', async () => {
    seed([]);
    const { getByText, getByLabelText, findByText } = await renderSheet();
    await press(getByText('儲存'));
    expect(await findByText('請輸入帳戶名稱')).toBeTruthy();
    await type(getByLabelText('名稱'), '信用卡');
    await type(getByLabelText('期初餘額'), 'abc');
    await press(getByText('儲存'));
    expect(await findByText('期初餘額格式錯誤')).toBeTruthy();
    expect(useLedgerStore.getState().accounts).toHaveLength(0);
  });

  it('信用卡負數期初 → 入帳為負分', async () => {
    seed([]);
    const { getByText, getByLabelText, getByRole, onClose } = await renderSheet();
    await type(getByLabelText('名稱'), '信用卡');
    await press(getByRole('tab', { name: '信用卡' })); // 類型分段(名稱輸入為 displayValue,Text 唯一)
    await type(getByLabelText('期初餘額'), '-5000');
    await press(getByText('儲存'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const accounts = useLedgerStore.getState().accounts;
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ type: 'credit', initialCents: -500_000 });
  });
});

describe('AccountSheet 編輯與刪除', () => {
  const account: Account = { id: 'a1', name: '現金', type: 'cash', initialCents: 0, createdAt: 1 };

  it('編輯:預填名稱/期初,改名儲存', async () => {
    seed([account]);
    const { getByText, findByDisplayValue, onClose } = await renderSheet({ initial: account });
    const nameInput = await findByDisplayValue('現金');
    await type(nameInput, '零用金');
    await press(getByText('儲存'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useLedgerStore.getState().accounts[0]).toMatchObject({ name: '零用金' });
  });

  it('被交易引用 → 刪除擋下並顯示 errInUse', async () => {
    const txn: Txn = {
      id: 't1', date: '2026-11-20', type: 'expense', amountCents: 250, category: 'food',
      accountId: 'a1', toAccountId: null, note: '', createdAt: 1, updatedAt: 1,
    };
    seed([account], [txn]);
    const { getByText, findByText, onClose } = await renderSheet({ initial: account });
    await press(getByText('刪除'));
    expect(await findByText('此帳戶仍有交易紀錄,無法刪除')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(useLedgerStore.getState().accounts).toHaveLength(1);
  });
});
