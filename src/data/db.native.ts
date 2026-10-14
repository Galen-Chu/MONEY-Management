/**
 * expo-sqlite 實作(native 平台檔;web 見 db.ts——Metro 按平台自動選檔)。
 * 開庫 + migration(冪等,PRAGMA user_version;邏輯見 migrations.ts)+ Sqlite Repository。
 */
import * as SQLite from 'expo-sqlite';

import type { Account, Txn } from '../domain/ledger';
import type { AccountRepository, TxnRepository, Repositories } from './repository';
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
  };
  return cached;
}
