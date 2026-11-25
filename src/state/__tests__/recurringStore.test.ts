/** recurringStore 測試:CRUD 驗證、確認入帳(交易生成+處置月)、本月略過。 */
import { InMemoryAccountRepository, InMemoryRecurringRepository, InMemoryTxnRepository } from '../../data/repository';
import { __resetForTest as resetLedger, useLedgerStore } from '../ledgerStore';
import { __resetForTest, useRecurringStore } from '../recurringStore';
import type { RecurringInput } from '../../domain/recurring';
import { todayKey, monthOf } from '../../domain/ledger';

function input(p: Partial<RecurringInput> = {}): RecurringInput {
  return { type: 'expense', amountCents: 15_000_00, category: 'housing', accountId: 'a1', dayOfMonth: 1, note: '房租', ...p };
}

async function setup() {
  resetLedger();
  __resetForTest();
  const accounts = new InMemoryAccountRepository([{ id: 'a1', name: '現金', type: 'cash', initialCents: 0, createdAt: 1 }]);
  useLedgerStore.getState().attach(accounts, new InMemoryTxnRepository());
  useLedgerStore.setState({ accounts: [{ id: 'a1', name: '現金', type: 'cash', initialCents: 0, createdAt: 1 }], txns: [] });
  useRecurringStore.getState().attach(new InMemoryRecurringRepository());
}

describe('CRUD', () => {
  it('新增/更新/刪除;非法輸入拒絕', async () => {
    await setup();
    expect(await useRecurringStore.getState().addRecurring(input({ amountCents: 0 }))).toBe(false);
    expect(await useRecurringStore.getState().addRecurring(input({ dayOfMonth: 32 }))).toBe(false);
    expect(await useRecurringStore.getState().addRecurring(input())).toBe(true);
    const id = useRecurringStore.getState().items[0]!.id;
    expect(await useRecurringStore.getState().updateRecurring(id, input({ note: '月房租', amountCents: 16_000_00 }))).toBe(true);
    expect(useRecurringStore.getState().items[0]).toMatchObject({ note: '月房租', amountCents: 16_000_00 });
    await useRecurringStore.getState().deleteRecurring(id);
    expect(useRecurringStore.getState().items).toHaveLength(0);
  });
});

describe('確認與略過(必經確認)', () => {
  it('確認:建立當月到期日交易 + 記處置月(同月不再提示)', async () => {
    await setup();
    await useRecurringStore.getState().addRecurring(input({ dayOfMonth: 1 }));
    const id = useRecurringStore.getState().items[0]!.id;
    expect(useRecurringStore.getState().pendingToday()).toHaveLength(1);

    expect(await useRecurringStore.getState().confirm(id)).toBe(true);
    const txns = useLedgerStore.getState().txns;
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({
      date: `${monthOf(todayKey())}-01`,
      amountCents: 15_000_00,
      note: '房租',
    });
    expect(useRecurringStore.getState().pendingToday()).toHaveLength(0); // 已處置
  });

  it('略過:不建交易,僅記處置月', async () => {
    await setup();
    await useRecurringStore.getState().addRecurring(input({ dayOfMonth: 1 }));
    const id = useRecurringStore.getState().items[0]!.id;
    await useRecurringStore.getState().skipThisMonth(id);
    expect(useLedgerStore.getState().txns).toHaveLength(0);
    expect(useRecurringStore.getState().pendingToday()).toHaveLength(0);
  });

  it('帳戶被刪 → confirm 回 false 不入帳', async () => {
    await setup();
    useRecurringStore.setState({
      items: [
        {
          id: 'r-ghost', type: 'expense', amountCents: 100, category: 'housing', accountId: 'ghost',
          dayOfMonth: 1, note: '', lastHandledMonth: null, createdAt: 1, updatedAt: 1,
        },
      ],
    });
    expect(await useRecurringStore.getState().confirm('r-ghost')).toBe(false);
    expect(useLedgerStore.getState().txns).toHaveLength(0);
  });
});
