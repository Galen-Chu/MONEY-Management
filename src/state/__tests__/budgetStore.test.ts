/** budgetStore 測試(InMemory repo):set/remove、驗證、guard。 */
import { InMemoryBudgetRepository } from '../../data/repository';
import { __resetForTest, useBudgetStore } from '../budgetStore';

async function setup() {
  __resetForTest();
  useBudgetStore.getState().attach(new InMemoryBudgetRepository());
}

describe('預算 store', () => {
  it('set → upsert 狀態;同分類覆寫;非法金額拒絕', async () => {
    await setup();
    expect(await useBudgetStore.getState().setBudget('food', 0)).toBe(false);
    expect(await useBudgetStore.getState().setBudget('salary', 100)).toBe(false); // 收入分類
    expect(await useBudgetStore.getState().setBudget('food', 100_000)).toBe(true);
    expect(await useBudgetStore.getState().setBudget('transport', 50_000)).toBe(true);
    expect(useBudgetStore.getState().budgets).toHaveLength(2);
    expect(await useBudgetStore.getState().setBudget('food', 80_000)).toBe(true); // 覆寫
    expect(useBudgetStore.getState().budgets).toHaveLength(2);
    expect(useBudgetStore.getState().budgets.find((b) => b.category === 'food')!.amountCents).toBe(80_000);
  });

  it('remove 與 bootstrap 重新載入', async () => {
    await setup();
    await useBudgetStore.getState().setBudget('food', 100_000);
    await useBudgetStore.getState().removeBudget('food');
    expect(useBudgetStore.getState().budgets).toHaveLength(0);
    await useBudgetStore.getState().bootstrap();
    expect(useBudgetStore.getState().budgets).toHaveLength(0);
  });

  it('guard:repo 拋錯 → error 狀態不外拋', async () => {
    __resetForTest();
    const bad = new InMemoryBudgetRepository();
    bad.upsert = async () => {
      throw new Error('disk full');
    };
    useBudgetStore.getState().attach(bad);
    await useBudgetStore.getState().setBudget('food', 100);
    expect(useBudgetStore.getState().error).toBe('disk full');
    useBudgetStore.getState().clearError();
    expect(useBudgetStore.getState().error).toBeNull();
  });
});
