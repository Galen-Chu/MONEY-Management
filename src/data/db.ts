/**
 * web 預覽/測試的 Repository 工廠:InMemory(不持久化)。
 * native 走 db.native.ts(expo-sqlite);介面同一份(repository.ts)。
 */
import {
  InMemoryAccountRepository,
  InMemoryAssetRepository,
  InMemoryBudgetRepository,
  InMemoryInvoiceRepository,
  InMemoryLoanRepository,
  InMemoryPrizeRepository,
  InMemoryRecurringRepository,
  InMemoryTxnRepository,
  InMemoryValuationRepository,
  type Repositories,
} from './repository';

export type { Repositories } from './repository';

let cached: Repositories | null = null;

export async function createRepositories(): Promise<Repositories> {
  if (cached) return cached;
  cached = {
    accounts: new InMemoryAccountRepository(),
    txns: new InMemoryTxnRepository(),
    loans: new InMemoryLoanRepository(),
    invoices: new InMemoryInvoiceRepository(),
    prizes: new InMemoryPrizeRepository(),
    assets: new InMemoryAssetRepository(),
    valuations: new InMemoryValuationRepository(),
    budgets: new InMemoryBudgetRepository(),
    recurring: new InMemoryRecurringRepository(),
  };
  return cached;
}

/** 測試用:清除工廠快取(每次 attach 新的 InMemory) */
export function __resetRepositoriesForTest(): void {
  cached = null;
}
