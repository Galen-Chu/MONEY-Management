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
