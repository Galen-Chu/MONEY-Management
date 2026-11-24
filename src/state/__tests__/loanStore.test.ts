/** loanStore 流程測試(InMemory repository):CRUD、驗證、guard。 */
import { InMemoryLoanRepository } from '../../data/repository';
import { __resetForTest, useLoanStore } from '../loanStore';
import type { LoanInput } from '../../domain/loan';

function input(p: Partial<LoanInput> = {}): LoanInput {
  return {
    name: '房貸',
    type: 'mortgage',
    principalCents: 100_000_000,
    annualRateMilliPercent: 2185,
    termMonths: 360,
    startDate: '2026-01-15',
    method: 'annuity',
    graceMonths: 36,
    ...p,
  };
}

async function setup() {
  __resetForTest();
  useLoanStore.getState().attach(new InMemoryLoanRepository());
}

describe('貸款 CRUD', () => {
  it('新增 → 列表依序;名稱修剪', async () => {
    await setup();
    const ok = await useLoanStore.getState().addLoan(input({ name: ' 台新房貸 ' }));
    expect(ok).toBe(true);
    expect(useLoanStore.getState().loans).toHaveLength(1);
    expect(useLoanStore.getState().loans[0]).toMatchObject({ name: '台新房貸', type: 'mortgage', graceMonths: 36 });

    await useLoanStore.getState().addLoan(input({ name: '車貸', type: 'car' }));
    expect(useLoanStore.getState().loans.map((l) => l.name)).toEqual(['台新房貸', '車貸']);
  });

  it('驗證失敗回 false 不寫入:空名稱/本金 0/寬限≥期數', async () => {
    await setup();
    expect(await useLoanStore.getState().addLoan(input({ name: ' ' }))).toBe(false);
    expect(await useLoanStore.getState().addLoan(input({ principalCents: 0 }))).toBe(false);
    expect(await useLoanStore.getState().addLoan(input({ graceMonths: 360 }))).toBe(false);
    expect(useLoanStore.getState().loans).toHaveLength(0);
  });

  it('更新利率與期數;bootstrap 重新載入', async () => {
    await setup();
    await useLoanStore.getState().addLoan(input());
    const id = useLoanStore.getState().loans[0]!.id;
    const ok = await useLoanStore.getState().updateLoan(id, input({ annualRateMilliPercent: 2400, termMonths: 300, graceMonths: 0 }));
    expect(ok).toBe(true);
    expect(useLoanStore.getState().loans[0]).toMatchObject({ annualRateMilliPercent: 2400, termMonths: 300 });
    await useLoanStore.getState().bootstrap();
    expect(useLoanStore.getState().loans[0]).toMatchObject({ annualRateMilliPercent: 2400, termMonths: 300 });
  });

  it('刪除', async () => {
    await setup();
    await useLoanStore.getState().addLoan(input());
    const id = useLoanStore.getState().loans[0]!.id;
    await useLoanStore.getState().deleteLoan(id);
    expect(useLoanStore.getState().loans).toHaveLength(0);
  });
});

describe('guard 錯誤防護', () => {
  it('repo 拋錯 → error 狀態、不外拋;clearError 清除', async () => {
    __resetForTest();
    const bad = new InMemoryLoanRepository();
    bad.insert = async () => {
      throw new Error('disk full');
    };
    useLoanStore.getState().attach(bad);
    await useLoanStore.getState().addLoan(input());
    expect(useLoanStore.getState().error).toBe('disk full');
    expect(useLoanStore.getState().loans).toHaveLength(0);
    useLoanStore.getState().clearError();
    expect(useLoanStore.getState().error).toBeNull();
  });
});
