/**
 * 資料層:Repository 介面 + InMemory 實作(測試與 web 預覽)。
 * native 以 expo-sqlite 實作(db.native.ts;Metro 按平台自動選檔);
 * store 僅依賴本介面(依賴方向:UI→state→domain←data)。
 */
import type { Account, Txn } from '../domain/ledger';
import type { Loan } from '../domain/loan';
import type { Invoice, PrizeNumbers } from '../domain/invoice';

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

export interface LoanRepository {
  list(): Promise<Loan[]>;
  insert(loan: Loan): Promise<void>;
  update(loan: Loan): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface InvoiceRepository {
  list(): Promise<Invoice[]>;
  insert(invoice: Invoice): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface PrizeRepository {
  get(term: string): Promise<PrizeNumbers | null>;
  upsert(prizes: PrizeNumbers): Promise<void>;
}

/** 平台工廠(db.ts / db.native.ts)回傳的組合 */
export interface Repositories {
  accounts: AccountRepository;
  txns: TxnRepository;
  loans: LoanRepository;
  invoices: InvoiceRepository;
  prizes: PrizeRepository;
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

export class InMemoryLoanRepository implements LoanRepository {
  private items: Loan[] = [];

  constructor(seed: Loan[] = []) {
    this.items = seed.map((l) => ({ ...l }));
  }

  async list(): Promise<Loan[]> {
    return this.items.map((l) => ({ ...l }));
  }

  async insert(loan: Loan): Promise<void> {
    this.items.push({ ...loan });
  }

  async update(loan: Loan): Promise<void> {
    const i = this.items.findIndex((l) => l.id === loan.id);
    if (i >= 0) this.items[i] = { ...loan };
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((l) => l.id !== id);
  }
}

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private items: Invoice[] = [];

  constructor(seed: Invoice[] = []) {
    this.items = seed.map((i) => ({ ...i }));
  }

  async list(): Promise<Invoice[]> {
    return this.items.map((i) => ({ ...i }));
  }

  async insert(invoice: Invoice): Promise<void> {
    this.items.push({ ...invoice });
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
  }
}

export class InMemoryPrizeRepository implements PrizeRepository {
  private items = new Map<string, PrizeNumbers>();

  async get(term: string): Promise<PrizeNumbers | null> {
    const hit = this.items.get(term);
    return hit ? { ...hit } : null;
  }

  async upsert(prizes: PrizeNumbers): Promise<void> {
    this.items.set(prizes.term, { ...prizes });
  }
}
