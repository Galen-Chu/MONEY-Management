/**
 * web 預覽/測試的 Repository 工廠:InMemory(不持久化)。
 * native 走 db.native.ts(expo-sqlite);介面同一份(repository.ts)。
 */
import { InMemoryAccountRepository, InMemoryTxnRepository, type Repositories } from './repository';

export type { Repositories } from './repository';

let cached: Repositories | null = null;

export async function createRepositories(): Promise<Repositories> {
  if (cached) return cached;
  cached = {
    accounts: new InMemoryAccountRepository(),
    txns: new InMemoryTxnRepository(),
  };
  return cached;
}

/** 測試用:清除工廠快取(每次 attach 新的 InMemory) */
export function __resetRepositoriesForTest(): void {
  cached = null;
}
