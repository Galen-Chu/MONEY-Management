/**
 * 資料層:Repository 介面 + InMemory 實作(測試與 web 預覽)。
 * native 以 expo-sqlite 實作(db.native.ts;Metro 按平台自動選檔);
 * store 僅依賴本介面(依賴方向:UI→state→domain←data)。
 */
import type { Account, Txn } from '../domain/ledger';
import type { Loan } from '../domain/loan';
import type { Invoice, PrizeNumbers } from '../domain/invoice';
import type { Asset, AssetValuation } from '../domain/asset';
import type { Budget } from '../domain/budget';
import type { RecurringTxn } from '../domain/recurring';

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

export interface AssetRepository {
  list(): Promise<Asset[]>;
  insert(asset: Asset): Promise<void>;
  update(asset: Asset): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ValuationRepository {
  listAll(): Promise<AssetValuation[]>;
  insert(valuation: AssetValuation): Promise<void>;
  remove(id: string): Promise<void>;
  removeByAsset(assetId: string): Promise<void>;
}

export interface BudgetRepository {
  list(): Promise<Budget[]>;
  upsert(budget: Budget): Promise<void>;
  remove(category: string): Promise<void>;
}

export interface RecurringRepository {
  list(): Promise<RecurringTxn[]>;
  insert(item: RecurringTxn): Promise<void>;
  update(item: RecurringTxn): Promise<void>;
  remove(id: string): Promise<void>;
}

/** 平台工廠(db.ts / db.native.ts)回傳的組合 */
export interface Repositories {
  accounts: AccountRepository;
  txns: TxnRepository;
  loans: LoanRepository;
  invoices: InvoiceRepository;
  prizes: PrizeRepository;
  assets: AssetRepository;
  valuations: ValuationRepository;
  budgets: BudgetRepository;
  recurring: RecurringRepository;
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

export class InMemoryAssetRepository implements AssetRepository {
  private items: Asset[] = [];

  constructor(seed: Asset[] = []) {
    this.items = seed.map((a) => ({ ...a }));
  }

  async list(): Promise<Asset[]> {
    return this.items.map((a) => ({ ...a }));
  }

  async insert(asset: Asset): Promise<void> {
    this.items.push({ ...asset });
  }

  async update(asset: Asset): Promise<void> {
    const i = this.items.findIndex((a) => a.id === asset.id);
    if (i >= 0) this.items[i] = { ...asset };
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((a) => a.id !== id);
  }
}

export class InMemoryValuationRepository implements ValuationRepository {
  private items: AssetValuation[] = [];

  constructor(seed: AssetValuation[] = []) {
    this.items = seed.map((v) => ({ ...v }));
  }

  async listAll(): Promise<AssetValuation[]> {
    return this.items.map((v) => ({ ...v }));
  }

  async insert(valuation: AssetValuation): Promise<void> {
    this.items.push({ ...valuation });
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((v) => v.id !== id);
  }

  async removeByAsset(assetId: string): Promise<void> {
    this.items = this.items.filter((v) => v.assetId !== assetId);
  }
}

export class InMemoryBudgetRepository implements BudgetRepository {
  private items = new Map<string, Budget>();

  constructor(seed: Budget[] = []) {
    for (const b of seed) this.items.set(b.category, { ...b });
  }

  async list(): Promise<Budget[]> {
    return [...this.items.values()].map((b) => ({ ...b }));
  }

  async upsert(budget: Budget): Promise<void> {
    this.items.set(budget.category, { ...budget });
  }

  async remove(category: string): Promise<void> {
    this.items.delete(category);
  }
}

export class InMemoryRecurringRepository implements RecurringRepository {
  private items: RecurringTxn[] = [];

  constructor(seed: RecurringTxn[] = []) {
    this.items = seed.map((r) => ({ ...r }));
  }

  async list(): Promise<RecurringTxn[]> {
    return this.items.map((r) => ({ ...r }));
  }

  async insert(item: RecurringTxn): Promise<void> {
    this.items.push({ ...item });
  }

  async update(item: RecurringTxn): Promise<void> {
    const i = this.items.findIndex((r) => r.id === item.id);
    if (i >= 0) this.items[i] = { ...item };
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((r) => r.id !== id);
  }
}
