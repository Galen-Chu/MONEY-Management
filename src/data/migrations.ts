/**
 * SQLite migration 定義與執行器(自 db.native.ts 抽離的純邏輯,介面注入可測)。
 * 每版一個交易:BEGIN → DDL → PRAGMA user_version=v+1 → COMMIT;
 * 失敗 ROLLBACK 後外拋(已提交的前置版本保留)——結構沿用 TIME-Management。
 */

/** migration 所需的最小資料庫介面(expo-sqlite SQLiteDatabase 的子集) */
export interface MigrationDb {
  execAsync(source: string): Promise<unknown>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

export const MIGRATIONS: readonly string[] = [
  // v1:accounts + transactions
  `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    initialCents INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    amountCents INTEGER NOT NULL,
    category TEXT,
    accountId TEXT NOT NULL,
    toAccountId TEXT,
    note TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_txns_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_txns_account ON transactions(accountId);
  `,
  // v3:loans(P1 貸款模組)
  `
  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    principalCents INTEGER NOT NULL,
    annualRateMilliPercent INTEGER NOT NULL,
    termMonths INTEGER NOT NULL,
    startDate TEXT NOT NULL,
    method TEXT NOT NULL,
    graceMonths INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  `,
  // v4:invoices + prize_numbers(P2 發票對獎)
  `
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY NOT NULL,
    term TEXT NOT NULL,
    number TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_invoices_term ON invoices(term);
  CREATE TABLE IF NOT EXISTS prize_numbers (
    term TEXT PRIMARY KEY NOT NULL,
    superNumber TEXT NOT NULL,
    specialNumber TEXT NOT NULL,
    firstNumbers TEXT NOT NULL,
    extraNumbers TEXT NOT NULL,
    fetchedAt INTEGER NOT NULL
  );
  `,
  // v5:assets + asset_valuations(P3 資產管理)
  `
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS asset_valuations (
    id TEXT PRIMARY KEY NOT NULL,
    assetId TEXT NOT NULL,
    date TEXT NOT NULL,
    valueCents INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_valuations_asset ON asset_valuations(assetId);
  CREATE INDEX IF NOT EXISTS idx_valuations_date ON asset_valuations(date);
  `,
  // v6:budgets(分類月預算)
  `
  CREATE TABLE IF NOT EXISTS budgets (
    category TEXT PRIMARY KEY NOT NULL,
    amountCents INTEGER NOT NULL
  );
  `,
  // v7:recurring(定期交易)
  `
  CREATE TABLE IF NOT EXISTS recurring (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    amountCents INTEGER NOT NULL,
    category TEXT NOT NULL,
    accountId TEXT NOT NULL,
    dayOfMonth INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    lastHandledMonth TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  `,
  // v8:notification_drafts(P6 通知管理批次一——簡訊貼上解析的待確認草稿;暫時性質不入備份)
  `
  CREATE TABLE IF NOT EXISTS notification_drafts (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    rawText TEXT NOT NULL,
    amountCents INTEGER,
    date TEXT,
    merchant TEXT,
    sender TEXT,
    cardLast4 TEXT,
    createdAt INTEGER NOT NULL
  );
  `,
  // v9:invoices 擴充載具欄位(P5——手動/載具同表,同號同期去重)+ carrier_settings(憑證僅存本機,不入備份)
  `
  ALTER TABLE invoices ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
  ALTER TABLE invoices ADD COLUMN date TEXT;
  ALTER TABLE invoices ADD COLUMN sellerName TEXT;
  ALTER TABLE invoices ADD COLUMN amountCents INTEGER;
  ALTER TABLE invoices ADD COLUMN cardType TEXT;
  CREATE TABLE IF NOT EXISTS carrier_settings (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    cardType TEXT NOT NULL,
    cardNo TEXT NOT NULL,
    cardEncrypt TEXT NOT NULL,
    appID TEXT NOT NULL DEFAULT '',
    updatedAt INTEGER NOT NULL
  );
  `,
];

/** 依 PRAGMA user_version 依序套用未執行的 migration(冪等);回傳本次套用版數 */
export async function applyMigrations(db: MigrationDb): Promise<number> {
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = current?.user_version ?? 0;
  let applied = 0;
  for (let v = version; v < MIGRATIONS.length; v++) {
    await db.execAsync('BEGIN;');
    try {
      await db.execAsync(MIGRATIONS[v]!);
      await db.execAsync(`PRAGMA user_version = ${v + 1};`);
      await db.execAsync('COMMIT;');
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      throw err;
    }
    applied++;
  }
  return applied;
}
