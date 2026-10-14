/** TxnRow 渲染測試(RNTL):分類 fallback、金額符號、轉帳呈現。 */
import { render } from '@testing-library/react-native';

import i18n from '../../../i18n';
import type { Txn } from '../../../domain/ledger';
import { TxnRow } from '../txn-row';

void i18n;

function txn(p: Partial<Txn>): Txn {
  return {
    id: 't1', date: '2026-10-01', type: 'expense', amountCents: 250,
    category: 'food', accountId: 'a1', toAccountId: null,
    note: '', createdAt: 1, updatedAt: 1, ...p,
  };
}

const names = (id: string) => (id === 'a1' ? '現金' : '銀行');

describe('TxnRow', () => {
  it('支出:備註為標題、− 金額、副行=分類·帳戶', async () => {
    const { getByText } = await render(
      <TxnRow txn={txn({ note: '午餐' })} accountName={names} onPress={() => {}} />
    );
    expect(getByText('午餐')).toBeTruthy();
    expect(getByText('餐飲 · 現金')).toBeTruthy();
    expect(getByText(/NT\$2\.5/)).toBeTruthy();
  });

  it('無備註 → 以分類名為標題', async () => {
    const { getByText } = await render(
      <TxnRow txn={txn({ note: '' })} accountName={names} onPress={() => {}} />
    );
    expect(getByText('餐飲')).toBeTruthy();
  });

  it('轉帳:⇄ 符號與 帳戶→帳戶 副行、中性色金額(無+/−)', async () => {
    const { getByText } = await render(
      <TxnRow
        txn={txn({ type: 'transfer', category: null, amountCents: 30000, toAccountId: 'a2', note: '提款' })}
        accountName={names}
        onPress={() => {}}
      />
    );
    expect(getByText('提款')).toBeTruthy();
    expect(getByText('現金 → 銀行')).toBeTruthy();
    expect(getByText(/^NT\$300/)).toBeTruthy();
  });
});
