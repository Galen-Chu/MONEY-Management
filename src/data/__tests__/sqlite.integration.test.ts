/**
 * SQLite 整合測試:以 better-sqlite3 轉接 expo-sqlite 介面,對「真 SQLite 引擎」執行——
 * v0→v9 全量遷移、冪等、**v8 舊庫升級 v9 的 ALTER 實測**(invoices 擴充欄 default manual)、
 * 各 Sqlite*Repository CRUD 往返(含載具欄位/憑證/通知草稿)。
 * 覆蓋目標:SQL 語法與欄位對齊(host 可驗部分);Expo Go 真機最終確認見 docs/DEVICE-CHECK.md。
 */
import Database from 'better-sqlite3';

type SqliteDb = {
  execAsync(sql: string): Promise<unknown>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string): Promise<T[]>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
};

const mockDbs: Database.Database[] = [];
const mockAdapters: SqliteDb[] = [];
let mockCurrentFactory: (() => SqliteDb) | null = null;

function wrap(db: Database.Database): SqliteDb {
  return {
    execAsync: async (sql) => db.exec(sql),
    runAsync: async (sql, params = []) => db.prepare(sql).run(...params),
    getAllAsync: async <T,>(sql: string, params: unknown[] = []): Promise<T[]> => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: unknown[] = []): Promise<T | null> =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
  };
}

function mockFreshDb(): SqliteDb {
  const db = new Database(':memory:');
  mockDbs.push(db);
  const a = wrap(db);
  mockAdapters.push(a);
  return a;
}

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => (mockCurrentFactory ? mockCurrentFactory() : mockFreshDb()),
}));

import { MIGRATIONS, applyMigrations } from '../migrations';
import type { Repositories } from '../repository';
import type { Invoice, InvoiceTerm } from '../../domain/invoice';
import type { RecurringTxn } from '../../domain/recurring';
import type { NotificationDraft } from '../../domain/notification';
import type { CarrierSettings } from '../carrier-source';

/** 隔離模組狀態(db.native 的 cached)取得一組新 repos */
function freshRepos(factory?: () => SqliteDb): Promise<Repositories> {
  mockCurrentFactory = factory ?? null;
  let repos: Repositories | null = null;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../db.native');
    repos = mod.createRepositories() as Repositories;
  });
  mockCurrentFactory = null;
  return Promise.resolve(repos!);
}

function manualInvoice(p: Partial<Invoice>): Invoice {
  return {
    id: 'i1', term: '11507' as InvoiceTerm, number: 'AB12345678', note: '', createdAt: 1,
    source: 'manual', date: null, sellerName: null, amountCents: null, cardType: null, ...p,
  };
}

describe('SQLite 遷移(真引擎)', () => {
  it('全新庫:v0→v9 一次到位、表齊全、user_version=9;再跑=冪等 0 版', async () => {
    const repos = await freshRepos();
    const db = mockDbs[mockDbs.length - 1]!;
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((r) => r.name);
    for (const t of ['accounts', 'transactions', 'loans', 'invoices', 'prize_numbers', 'assets', 'asset_valuations', 'budgets', 'recurring', 'notification_drafts', 'carrier_settings']) {
      expect(tables).toContain(t);
    }
    const adapter = mockAdapters[mockAdapters.length - 1]!;
    expect(await applyMigrations(adapter)).toBe(0); // 冪等
    void repos;
  });

  it('v8 舊庫升級 v9:ALTER 後舊發票 default manual、新欄可寫', async () => {
    const old = new Database(':memory:');
    for (let i = 0; i < 8; i++) {
      old.exec(MIGRATIONS[i]!);
      old.exec(`PRAGMA user_version = ${i + 1};`);
    }
    old
      .prepare('INSERT INTO invoices (id, term, number, note, createdAt) VALUES (?,?,?,?,?)')
      .run('old1', '11507', 'ZZ00000000', '舊資料', 1);
    const adapter = wrap(old);
    const repos = await freshRepos(() => adapter);

    expect(old.prepare('PRAGMA user_version').get()).toEqual({ user_version: 9 });
    const migrated = (await repos.invoices.list()).find((i) => i.id === 'old1');
    expect(migrated).toMatchObject({ source: 'manual', date: null, sellerName: null, amountCents: null, cardType: null });

    await repos.invoices.insert(manualInvoice({ id: 'c1', source: 'carrier', date: '2026-07-20', sellerName: '統一超商', amountCents: 4500, cardType: '3J0002' }));
    const carrier = (await repos.invoices.list()).find((i) => i.id === 'c1');
    expect(carrier).toMatchObject({ source: 'carrier', date: '2026-07-20', sellerName: '統一超商', amountCents: 4500, cardType: '3J0002' });
  });
});

describe('SQLite Repository CRUD(真引擎)', () => {
  it('帳戶/交易:insert→list→update→remove', async () => {
    const repos = await freshRepos();
    const account = { id: 'a1', name: '現金', type: 'cash' as const, initialCents: -500_000, createdAt: 1 };
    await repos.accounts.insert(account);
    await repos.accounts.update({ ...account, name: '零用金' });
    expect(await repos.accounts.list()).toEqual([{ ...account, name: '零用金' }]);
    await repos.accounts.remove('a1');
    expect(await repos.accounts.list()).toEqual([]);

    const txn = {
      id: 't1', date: '2026-11-25', type: 'transfer' as const, amountCents: 100_000, category: null,
      accountId: 'a1', toAccountId: 'a2', note: '轉', createdAt: 1, updatedAt: 1,
    };
    await repos.txns.insert(txn);
    await repos.txns.update({ ...txn, amountCents: 200_000 });
    expect(await repos.txns.listAll()).toEqual([{ ...txn, amountCents: 200_000 }]);
    await repos.txns.remove('t1');
    expect(await repos.txns.listAll()).toEqual([]);
  });

  it('貸款/資產/估值(含 removeByAsset)/預算/定期/獎號', async () => {
    const repos = await freshRepos();
    const loan = {
      id: 'l1', name: '房貸', type: 'mortgage' as const, principalCents: 10_000_000_00,
      annualRateMilliPercent: 2185, termMonths: 360, startDate: '2026-01-01',
      method: 'annuity' as const, graceMonths: 0, createdAt: 1, updatedAt: 1,
    };
    await repos.loans.insert(loan);
    expect(await repos.loans.list()).toEqual([loan]);

    await repos.assets.insert({ id: 'as1', name: '公寓', type: 'real-estate', createdAt: 5, updatedAt: 5 });
    await repos.valuations.insert({ id: 'v1', assetId: 'as1', date: '2026-01-31', valueCents: 10_000_000_00, createdAt: 5 });
    await repos.valuations.insert({ id: 'v2', assetId: 'as1', date: '2026-02-28', valueCents: 10_100_000_00, createdAt: 6 });
    expect(await repos.valuations.listAll()).toHaveLength(2);
    await repos.valuations.removeByAsset('as1');
    expect(await repos.valuations.listAll()).toEqual([]);

    await repos.budgets.upsert({ category: 'food', amountCents: 100_000 });
    expect(await repos.budgets.list()).toEqual([{ category: 'food', amountCents: 100_000 }]);
    await repos.budgets.remove('food');
    expect(await repos.budgets.list()).toEqual([]);

    const recurring: RecurringTxn = {
      id: 'r1', type: 'expense', amountCents: 15_000_00, category: 'housing', accountId: 'a1',
      dayOfMonth: 5, note: '房租', lastHandledMonth: '2026-11', createdAt: 6, updatedAt: 6,
    };
    await repos.recurring.insert(recurring);
    expect(await repos.recurring.list()).toEqual([recurring]);

    await repos.prizes.upsert({
      term: '11507', superNumber: '89996565', specialNumber: '91098182',
      firstNumbers: ['54348835'], extraNumbers: [], fetchedAt: 1,
    });
    expect((await repos.prizes.get('11507'))?.superNumber).toBe('89996565');
  });

  it('通知草稿與載具憑證(可空欄往返)', async () => {
    const repos = await freshRepos();
    const draft: NotificationDraft = {
      id: 'd1', source: 'sms', rawText: '【台新銀行】…新台幣1,234元', amountCents: 123_400,
      date: '2026-11-24', merchant: '統一超商', sender: '台新銀行', cardLast4: '5678', createdAt: 1,
    };
    await repos.notificationDrafts.insert(draft);
    expect(await repos.notificationDrafts.list()).toEqual([draft]);
    await repos.notificationDrafts.remove('d1');
    expect(await repos.notificationDrafts.list()).toEqual([]);

    expect(await repos.carrier.get()).toBeNull();
    const settings: CarrierSettings & { updatedAt: number } = {
      cardType: '3J0002', cardNo: '/ABC.123', cardEncrypt: '9876', appID: 'APP001', updatedAt: 9,
    };
    await repos.carrier.save(settings);
    expect(await repos.carrier.get()).toEqual(settings);
    await repos.carrier.save({ ...settings, appID: 'APP002', updatedAt: 10 });
    expect((await repos.carrier.get())?.appID).toBe('APP002');
  });
});
