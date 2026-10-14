/**
 * 資料層:Repository 介面 + InMemory 實作(測試與 web 預覽)。
 * native 以 expo-sqlite 實作(db.native.ts;Metro 按平台自動選檔);
 * store 僅依賴本介面(依賴方向:UI→state→domain←data)。
 */
import type { Account, Txn } from '../domain/ledger';

export interface AccountRepository {
  list(): Promise<Account[]>;
  insert(account: Account): Promise<void>;
  update(account: Account): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface TxnRepository {
  listAll(): Promise<Txn[]>;
  insert(txn: Txn): Promise<void>;
  update(txn: Txn): Promise<void>;
  remove(id: string): Promise<void>;
}

/** 平台工廠(db.ts / db.native.ts)回傳的組合 */
export interface Repositories {
  accounts: AccountRepository;
  txns: TxnRepository;
}

export class InMemoryAccountRepository implements AccountRepository {
  private items: Account[] = [];

  constructor(seed: Account[] = []) {
    this.items = seed.map((a) => ({ ...a }));
  }

  async list(): Promise<Account[]> {
    return this.items.map((a) => ({ ...a }));
  }

  async insert(account: Account): Promise<void> {
    this.items.push({ ...account });
  }

  async update(account: Account): Promise<void> {
    const i = this.items.findIndex((a) => a.id === account.id);
    if (i >= 0) this.items[i] = { ...account };
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((a) => a.id !== id);
  }
}

export class InMemoryTxnRepository implements TxnRepository {
  private items: Txn[] = [];

  async listAll(): Promise<Txn[]> {
    return this.items.map((t) => ({ ...t }));
  }

  async insert(txn: Txn): Promise<void> {
    this.items.push({ ...txn });
  }

  async update(txn: Txn): Promise<void> {
    const i = this.items.findIndex((t) => t.id === txn.id);
    if (i >= 0) this.items[i] = { ...txn };
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((t) => t.id !== id);
  }
}
