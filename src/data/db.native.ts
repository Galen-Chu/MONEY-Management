/**
 * expo-sqlite 實作(native 平台檔;web 見 db.ts——Metro 按平台自動選檔)。
 * 開庫 + migration(冪等,PRAGMA user_version;邏輯見 migrations.ts)+ Sqlite Repository。
 */
import * as SQLite from 'expo-sqlite';

import type { Account, Txn } from '../domain/ledger';
import type { Loan } from '../domain/loan';
import type { Invoice, PrizeNumbers } from '../domain/invoice';
import type { Asset, AssetValuation } from '../domain/asset';
import type { Budget } from '../domain/budget';
import type { RecurringTxn } from '../domain/recurring';
import type { NotificationDraft } from '../domain/notification';
import type {
  AccountRepository,
  TxnRepository,
  LoanRepository,
  InvoiceRepository,
  PrizeRepository,
  AssetRepository,
  ValuationRepository,
  BudgetRepository,
  RecurringRepository,
  NotificationDraftRepository,
  Repositories,
} from './repository';
import { applyMigrations } from './migrations';

export type { Repositories } from './repository';

interface AccountRow {
  id: string; name: string; type: string; initialCents: number; createdAt: number;
}

interface TxnRow {
  id: string; date: string; type: string; amountCents: number;
  category: string | null; accountId: string; toAccountId: string | null;
  note: string; createdAt: number; updatedAt: number;
}

function rowToTxn(r: TxnRow): Txn {
  return {
    id: r.id,
    date: r.date,
    type: r.type as Txn['type'],
    amountCents: r.amountCents,
    category: (r.category as Txn['category']) ?? null,
    accountId: r.accountId,
    toAccountId: r.toAccountId ?? null,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async list(): Promise<Account[]> {
    const rows = await this.db.getAllAsync<AccountRow>(
      'SELECT * FROM accounts ORDER BY createdAt'
    );
    return rows.map((r) => ({ ...r, type: r.type as Account['type'] }));
  }

  async insert(a: Account): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO accounts (id, name, type, initialCents, createdAt) VALUES (?,?,?,?,?)',
      [a.id, a.name, a.type, a.initialCents, a.createdAt]
    );
  }

  async update(a: Account): Promise<void> {
    await this.db.runAsync(
      'UPDATE accounts SET name=?, type=?, initialCents=? WHERE id=?',
      [a.name, a.type, a.initialCents, a.id]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM accounts WHERE id=?', [id]);
  }
}

export class SqliteTxnRepository implements TxnRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async listAll(): Promise<Txn[]> {
    const rows = await this.db.getAllAsync<TxnRow>(
      'SELECT * FROM transactions ORDER BY date DESC, createdAt'
    );
    return rows.map(rowToTxn);
  }

  async insert(t: Txn): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO transactions (id, date, type, amountCents, category, accountId, toAccountId, note, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [t.id, t.date, t.type, t.amountCents, t.category, t.accountId, t.toAccountId, t.note, t.createdAt, t.updatedAt]
    );
  }

  async update(t: Txn): Promise<void> {
    await this.db.runAsync(
      'UPDATE transactions SET date=?, type=?, amountCents=?, category=?, accountId=?, toAccountId=?, note=?, updatedAt=? WHERE id=?',
      [t.date, t.type, t.amountCents, t.category, t.accountId, t.toAccountId, t.note, t.updatedAt, t.id]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM transactions WHERE id=?', [id]);
  }
}

interface LoanRow {
  id: string; name: string; type: string; principalCents: number;
  annualRateMilliPercent: number; termMonths: number; startDate: string;
  method: string; graceMonths: number; createdAt: number; updatedAt: number;
}

export class SqliteLoanRepository implements LoanRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async list(): Promise<Loan[]> {
    const rows = await this.db.getAllAsync<LoanRow>(
      'SELECT * FROM loans ORDER BY createdAt'
    );
    return rows.map((r) => ({
      ...r,
      type: r.type as Loan['type'],
      method: r.method as Loan['method'],
    }));
  }

  async insert(l: Loan): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO loans (id, name, type, principalCents, annualRateMilliPercent, termMonths, startDate, method, graceMonths, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [l.id, l.name, l.type, l.principalCents, l.annualRateMilliPercent, l.termMonths, l.startDate, l.method, l.graceMonths, l.createdAt, l.updatedAt]
    );
  }

  async update(l: Loan): Promise<void> {
    await this.db.runAsync(
      'UPDATE loans SET name=?, type=?, principalCents=?, annualRateMilliPercent=?, termMonths=?, startDate=?, method=?, graceMonths=?, updatedAt=? WHERE id=?',
      [l.name, l.type, l.principalCents, l.annualRateMilliPercent, l.termMonths, l.startDate, l.method, l.graceMonths, l.updatedAt, l.id]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM loans WHERE id=?', [id]);
  }
}

interface InvoiceRow {
  id: string; term: string; number: string; note: string; createdAt: number;
}

export class SqliteInvoiceRepository implements InvoiceRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async list(): Promise<Invoice[]> {
    return await this.db.getAllAsync<InvoiceRow>(
      'SELECT * FROM invoices ORDER BY createdAt DESC'
    );
  }

  async insert(i: Invoice): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO invoices (id, term, number, note, createdAt) VALUES (?,?,?,?,?)',
      [i.id, i.term, i.number, i.note, i.createdAt]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM invoices WHERE id=?', [id]);
  }
}

export class SqlitePrizeRepository implements PrizeRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async get(term: string): Promise<PrizeNumbers | null> {
    const row = await this.db.getFirstAsync<{
      term: string; superNumber: string; specialNumber: string;
      firstNumbers: string; extraNumbers: string; fetchedAt: number;
    }>('SELECT * FROM prize_numbers WHERE term=?', [term]);
    if (!row) return null;
    return {
      term: row.term,
      superNumber: row.superNumber,
      specialNumber: row.specialNumber,
      firstNumbers: row.firstNumbers.split(','),
      extraNumbers: row.extraNumbers ? row.extraNumbers.split(',') : [],
      fetchedAt: row.fetchedAt,
    };
  }

  async upsert(p: PrizeNumbers): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO prize_numbers (term, superNumber, specialNumber, firstNumbers, extraNumbers, fetchedAt)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(term) DO UPDATE SET superNumber=excluded.superNumber, specialNumber=excluded.specialNumber,
         firstNumbers=excluded.firstNumbers, extraNumbers=excluded.extraNumbers, fetchedAt=excluded.fetchedAt`,
      [p.term, p.superNumber, p.specialNumber, p.firstNumbers.join(','), p.extraNumbers.join(','), p.fetchedAt]
    );
  }
}

interface AssetRow {
  id: string; name: string; type: string; createdAt: number; updatedAt: number;
}

export class SqliteAssetRepository implements AssetRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async list(): Promise<Asset[]> {
    const rows = await this.db.getAllAsync<AssetRow>('SELECT * FROM assets ORDER BY createdAt');
    return rows.map((r) => ({ ...r, type: r.type as Asset['type'] }));
  }

  async insert(a: Asset): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO assets (id, name, type, createdAt, updatedAt) VALUES (?,?,?,?,?)',
      [a.id, a.name, a.type, a.createdAt, a.updatedAt]
    );
  }

  async update(a: Asset): Promise<void> {
    await this.db.runAsync(
      'UPDATE assets SET name=?, type=?, updatedAt=? WHERE id=?',
      [a.name, a.type, a.updatedAt, a.id]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM assets WHERE id=?', [id]);
  }
}

interface ValuationRow {
  id: string; assetId: string; date: string; valueCents: number; createdAt: number;
}

export class SqliteValuationRepository implements ValuationRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async listAll(): Promise<AssetValuation[]> {
    return await this.db.getAllAsync<ValuationRow>(
      'SELECT * FROM asset_valuations ORDER BY date, createdAt'
    );
  }

  async insert(v: AssetValuation): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO asset_valuations (id, assetId, date, valueCents, createdAt) VALUES (?,?,?,?,?)',
      [v.id, v.assetId, v.date, v.valueCents, v.createdAt]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM asset_valuations WHERE id=?', [id]);
  }

  async removeByAsset(assetId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM asset_valuations WHERE assetId=?', [assetId]);
  }
}

export class SqliteBudgetRepository implements BudgetRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async list(): Promise<Budget[]> {
    const rows = await this.db.getAllAsync<{ category: string; amountCents: number }>(
      'SELECT * FROM budgets ORDER BY category'
    );
    return rows.map((r) => ({ category: r.category as Budget['category'], amountCents: r.amountCents }));
  }

  async upsert(b: Budget): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO budgets (category, amountCents) VALUES (?,?)
       ON CONFLICT(category) DO UPDATE SET amountCents=excluded.amountCents`,
      [b.category, b.amountCents]
    );
  }

  async remove(category: string): Promise<void> {
    await this.db.runAsync('DELETE FROM budgets WHERE category=?', [category]);
  }
}

interface RecurringRow {
  id: string; type: string; amountCents: number; category: string; accountId: string;
  dayOfMonth: number; note: string; lastHandledMonth: string | null; createdAt: number; updatedAt: number;
}

export class SqliteRecurringRepository implements RecurringRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async list(): Promise<RecurringTxn[]> {
    const rows = await this.db.getAllAsync<RecurringRow>('SELECT * FROM recurring ORDER BY createdAt');
    return rows.map((r) => ({
      ...r,
      type: r.type as RecurringTxn['type'],
      category: r.category as RecurringTxn['category'],
    }));
  }

  async insert(r: RecurringTxn): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO recurring (id, type, amountCents, category, accountId, dayOfMonth, note, lastHandledMonth, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [r.id, r.type, r.amountCents, r.category, r.accountId, r.dayOfMonth, r.note, r.lastHandledMonth, r.createdAt, r.updatedAt]
    );
  }

  async update(r: RecurringTxn): Promise<void> {
    await this.db.runAsync(
      'UPDATE recurring SET type=?, amountCents=?, category=?, accountId=?, dayOfMonth=?, note=?, lastHandledMonth=?, updatedAt=? WHERE id=?',
      [r.type, r.amountCents, r.category, r.accountId, r.dayOfMonth, r.note, r.lastHandledMonth, r.updatedAt, r.id]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM recurring WHERE id=?', [id]);
  }
}

interface NotificationDraftRow {
  id: string; source: string; rawText: string; amountCents: number | null; date: string | null;
  merchant: string | null; sender: string | null; cardLast4: string | null; createdAt: number;
}

export class SqliteNotificationDraftRepository implements NotificationDraftRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async list(): Promise<NotificationDraft[]> {
    const rows = await this.db.getAllAsync<NotificationDraftRow>(
      'SELECT * FROM notification_drafts ORDER BY createdAt'
    );
    return rows.map((r) => ({ ...r, source: r.source as NotificationDraft['source'] }));
  }

  async insert(d: NotificationDraft): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO notification_drafts (id, source, rawText, amountCents, date, merchant, sender, cardLast4, createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
      [d.id, d.source, d.rawText, d.amountCents, d.date, d.merchant, d.sender, d.cardLast4, d.createdAt]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM notification_drafts WHERE id=?', [id]);
  }
}

let cached: Repositories | null = null;

/** Repository 工廠(native):expo-sqlite 開庫 + migration(冪等) */
export async function createRepositories(): Promise<Repositories> {
  if (cached) return cached;
  const db = await SQLite.openDatabaseAsync('moneycare.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await applyMigrations(db);
  cached = {
    accounts: new SqliteAccountRepository(db),
    txns: new SqliteTxnRepository(db),
    loans: new SqliteLoanRepository(db),
    invoices: new SqliteInvoiceRepository(db),
    prizes: new SqlitePrizeRepository(db),
    assets: new SqliteAssetRepository(db),
    valuations: new SqliteValuationRepository(db),
    budgets: new SqliteBudgetRepository(db),
    recurring: new SqliteRecurringRepository(db),
    notificationDrafts: new SqliteNotificationDraftRepository(db),
  };
  return cached;
}
