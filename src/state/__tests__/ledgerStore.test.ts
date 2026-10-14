/** ledgerStore 流程測試(InMemory repository):帳戶/交易 CRUD、驗證、guard。 */
import { InMemoryAccountRepository, InMemoryTxnRepository } from '../../data/repository';
import { __resetForTest, useLedgerStore } from '../ledgerStore';

const TODAY = '2026-10-07';

async function setup() {
  __resetForTest();
  useLedgerStore.getState().attach(new InMemoryAccountRepository(), new InMemoryTxnRepository());
  await useLedgerStore.getState().addAccount({ name: '現金', type: 'cash', initialCents: 100000 });
  await useLedgerStore.getState().addAccount({ name: '銀行', type: 'bank', initialCents: 500000 });
}

describe('帳戶 CRUD', () => {
  it('新增 → 列表依序;空名稱拒絕', async () => {
    await setup();
    const s = useLedgerStore.getState();
    expect(s.accounts.map((a) => a.name)).toEqual(['現金', '銀行']);
    const ok = await s.addAccount({ name: '  ', type: 'credit', initialCents: 0 });
    expect(ok).toBe(false);
    expect(useLedgerStore.getState().accounts).toHaveLength(2);
  });

  it('更新名稱/期初;bootstrap 重新載入', async () => {
    await setup();
    const s = useLedgerStore.getState();
    const id = s.accounts[0]!.id;
    await s.updateAccount(id, { name: '皮夾', type: 'cash', initialCents: 50000 });
    expect(useLedgerStore.getState().accounts[0]).toMatchObject({ name: '皮夾', initialCents: 50000 });
    await useLedgerStore.getState().bootstrap();
    expect(useLedgerStore.getState().accounts[0]!.name).toBe('皮夾');
  });

  it('有交易引用 → 刪除回 false;無引用可刪', async () => {
    await setup();
    const s = useLedgerStore.getState();
    const cash = s.accounts[0]!;
    await s.addTxn({
      date: TODAY, type: 'expense', amountCents: 1200, category: 'food',
      accountId: cash.id, toAccountId: null, note: '午餐',
    });
    expect(await useLedgerStore.getState().deleteAccount(cash.id)).toBe(false);
    const bank = useLedgerStore.getState().accounts[1]!;
    expect(await useLedgerStore.getState().deleteAccount(bank.id)).toBe(true);
    expect(useLedgerStore.getState().accounts).toHaveLength(1);
  });
});

describe('交易 CRUD 與驗證', () => {
  it('新增支出 → 出現在列表且備註修剪', async () => {
    await setup();
    const s = useLedgerStore.getState();
    const ok = await s.addTxn({
      date: TODAY, type: 'expense', amountCents: 1200, category: 'food',
      accountId: s.accounts[0]!.id, toAccountId: null, note: ' 午餐 ',
    });
    expect(ok).toBe(true);
    const t = useLedgerStore.getState().txns[0]!;
    expect(t.note).toBe('午餐');
    expect(t.type).toBe('expense');
  });

  it('驗證失敗回 false 不寫入:金額 0/缺分類/轉帳同戶', async () => {
    await setup();
    const s = useLedgerStore.getState();
    const base = { date: TODAY, type: 'expense' as const, category: 'food' as const, accountId: s.accounts[0]!.id, note: '' };
    expect(await s.addTxn({ ...base, amountCents: 0, toAccountId: null })).toBe(false);
    expect(await s.addTxn({ ...base, amountCents: 100, category: null, toAccountId: null })).toBe(false);
    expect(
      await s.addTxn({
        date: TODAY, type: 'transfer', amountCents: 100, category: null,
        accountId: s.accounts[0]!.id, toAccountId: s.accounts[0]!.id, note: '',
      })
    ).toBe(false);
    expect(useLedgerStore.getState().txns).toHaveLength(0);
  });

  it('更新與刪除', async () => {
    await setup();
    const s = useLedgerStore.getState();
    await s.addTxn({
      date: TODAY, type: 'expense', amountCents: 1200, category: 'food',
      accountId: s.accounts[0]!.id, toAccountId: null, note: '午餐',
    });
    const id = useLedgerStore.getState().txns[0]!.id;
    const ok = await useLedgerStore.getState().updateTxn(id, {
      date: TODAY, type: 'expense', amountCents: 1500, category: 'transport',
      accountId: useLedgerStore.getState().accounts[0]!.id, toAccountId: null, note: '計程車',
    });
    expect(ok).toBe(true);
    expect(useLedgerStore.getState().txns[0]).toMatchObject({ amountCents: 1500, note: '計程車' });
    await useLedgerStore.getState().deleteTxn(id);
    expect(useLedgerStore.getState().txns).toHaveLength(0);
  });

  it('轉帳雙邊生效(餘額可由 domain 驗證)', async () => {
    await setup();
    const s = useLedgerStore.getState();
    const [cash, bank] = s.accounts;
    await s.addTxn({
      date: TODAY, type: 'transfer', amountCents: 30000, category: null,
      accountId: bank!.id, toAccountId: cash!.id, note: '提款',
    });
    expect(useLedgerStore.getState().txns).toHaveLength(1);
    expect(useLedgerStore.getState().txns[0]!.toAccountId).toBe(cash!.id);
  });
});

describe('guard 錯誤防護', () => {
  it('repo 拋錯 → error 狀態、不外拋;clearError 清除', async () => {
    __resetForTest();
    const bad = new InMemoryTxnRepository();
    bad.insert = async () => {
      throw new Error('disk full');
    };
    useLedgerStore.getState().attach(new InMemoryAccountRepository(), bad);
    await useLedgerStore.getState().addAccount({ name: '現金', type: 'cash', initialCents: 0 });
    const s = useLedgerStore.getState();
    await s.addTxn({
      date: TODAY, type: 'expense', amountCents: 100, category: 'food',
      accountId: useLedgerStore.getState().accounts[0]!.id, toAccountId: null, note: '',
    });
    expect(useLedgerStore.getState().error).toBe('disk full');
    expect(useLedgerStore.getState().txns).toHaveLength(0);
    useLedgerStore.getState().clearError();
    expect(useLedgerStore.getState().error).toBeNull();
  });
});
