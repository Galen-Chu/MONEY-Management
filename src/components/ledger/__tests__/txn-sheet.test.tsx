/** TxnSheet 表單測試(RNTL):驗證訊息(金額/分類/轉帳同帳戶)、類型切換(收入集/轉帳雙戶分支)、preset 預填、編輯刪除。
 *  本環境 RNTL 為 async render——互動一律包進 await act(async ...) 序列化 act scope,
 *  否則同步 fireEvent 與未收尾的 render act 重疊、狀態更新靜默丟失(實測教訓)。 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';

import i18n from '../../../i18n';
import { TxnSheet } from '../txn-sheet';
import type { Account, Txn } from '../../../domain/ledger';
import { InMemoryAccountRepository, InMemoryTxnRepository } from '../../../data/repository';
import { __resetForTest, useLedgerStore } from '../../../state/ledgerStore';

void i18n;

type TxnSheetProps = ComponentProps<typeof TxnSheet>;

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const ACCOUNTS: Account[] = [
  { id: 'a1', name: '現金', type: 'cash', initialCents: 0, createdAt: 1 },
  { id: 'a2', name: '銀行', type: 'bank', initialCents: 0, createdAt: 2 },
];

function seed(accounts: Account[]) {
  __resetForTest();
  useLedgerStore.getState().attach(new InMemoryAccountRepository(accounts), new InMemoryTxnRepository());
  useLedgerStore.setState({ accounts, txns: [] });
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

async function renderSheet(props: Partial<TxnSheetProps> = {}) {
  const onClose = jest.fn();
  const utils = await render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <TxnSheet visible onClose={onClose} initial={null} {...props} />
    </SafeAreaProvider>
  );
  return { ...utils, onClose };
}

describe('TxnSheet 驗證', () => {
  it('空表單 → 金額錯誤;有金額無分類 → 分類錯誤', async () => {
    seed(ACCOUNTS);
    const { getByText, getByLabelText, findByText } = await renderSheet();
    await press(getByText('儲存'));
    expect(await findByText('金額需大於 0')).toBeTruthy();
    await type(getByLabelText('金額'), '250');
    await press(getByText('儲存'));
    expect(await findByText('請選擇分類')).toBeTruthy();
  });

  it('支出填滿 → 儲存成功(onClose、入帳正確)', async () => {
    seed(ACCOUNTS);
    const { getByText, getByLabelText, onClose } = await renderSheet();
    await type(getByLabelText('金額'), '250');
    await press(getByText('餐飲'));
    await press(getByText('儲存'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const txns = useLedgerStore.getState().txns;
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ type: 'expense', amountCents: 25_000, category: 'food', accountId: 'a1' });
  });
});

describe('TxnSheet 類型切換', () => {
  it('收入 → 分類集切換(薪資出現、餐飲消失)', async () => {
    seed(ACCOUNTS);
    const { getByText, queryByText, findByText } = await renderSheet();
    await press(getByText('收入'));
    expect(await findByText('薪資')).toBeTruthy();
    expect(queryByText('餐飲')).toBeNull();
  });

  it('轉帳 → 雙戶欄位出現、分類欄隱藏;不同帳戶(預設 a1→a2)直接入帳', async () => {
    seed(ACCOUNTS);
    const { getByText, queryByText, getByLabelText, findByText, onClose } = await renderSheet();
    await press(getByText('轉帳'));
    expect(await findByText('轉出帳戶')).toBeTruthy();
    expect(await findByText('轉入帳戶')).toBeTruthy();
    await waitFor(() => expect(queryByText('分類')).toBeNull());
    await type(getByLabelText('金額'), '1000');
    await press(getByText('儲存'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const txns = useLedgerStore.getState().txns;
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ type: 'transfer', amountCents: 100_000, accountId: 'a1', toAccountId: 'a2' });
  });

  it('轉帳但僅一個帳戶(預設同戶)→ 同帳戶錯誤', async () => {
    seed([ACCOUNTS[0]!]);
    const { getByText, getByLabelText, findByText } = await renderSheet();
    await press(getByText('轉帳'));
    await type(getByLabelText('金額'), '100');
    await press(getByText('儲存'));
    expect(await findByText('轉出與轉入帳戶不可相同')).toBeTruthy();
    expect(useLedgerStore.getState().txns).toHaveLength(0);
  });
});

describe('TxnSheet preset 與編輯', () => {
  it('preset 預填:金額/備註,分類已選可直接儲存', async () => {
    seed(ACCOUNTS);
    const { getByText, findByDisplayValue, onClose } = await renderSheet({
      preset: { date: '2026-11-25', amountCents: 59_900, note: '蝦皮購物', category: 'other' },
    });
    expect(await findByDisplayValue('599')).toBeTruthy();
    expect(await findByDisplayValue('蝦皮購物')).toBeTruthy();
    await press(getByText('儲存'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useLedgerStore.getState().txns[0]).toMatchObject({ amountCents: 59_900, category: 'other', note: '蝦皮購物' });
  });

  it('編輯模式:預填+刪除', async () => {
    seed(ACCOUNTS);
    const txn: Txn = {
      id: 't1', date: '2026-11-20', type: 'expense', amountCents: 25_000, category: 'food',
      accountId: 'a1', toAccountId: null, note: '午餐', createdAt: 1, updatedAt: 1,
    };
    useLedgerStore.setState({ txns: [txn] });
    const { getByText, findByDisplayValue, onClose } = await renderSheet({ initial: txn });
    expect(await findByDisplayValue('250')).toBeTruthy();
    expect(await findByDisplayValue('午餐')).toBeTruthy();
    await press(getByText('刪除'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useLedgerStore.getState().txns).toHaveLength(0);
  });
});
