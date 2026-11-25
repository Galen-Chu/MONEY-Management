/** migration 執行器測試(介面注入 FakeDb):順序、冪等、失敗回滾。 */
import { MIGRATIONS, applyMigrations, type MigrationDb } from '../migrations';

function makeFakeDb(startVersion: number, failOn?: string) {
  const log: string[] = [];
  let version = startVersion;
  const db: MigrationDb = {
    async execAsync(sql: string) {
      if (failOn && sql.includes(failOn)) throw new Error('boom');
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m) version = Number(m[1]);
      log.push(sql.trim().split('\n')[0]!.slice(0, 24));
      return null;
    },
    async getFirstAsync<T>(): Promise<T | null> {
      return { user_version: version } as unknown as T;
    },
  };
  return { db, log, version: () => version };
}

describe('applyMigrations', () => {
  it('v0 → 依序套用全部;每版包在交易內且更新 user_version', async () => {
    const f = makeFakeDb(0);
    const applied = await applyMigrations(f.db);
    expect(applied).toBe(MIGRATIONS.length);
    expect(f.version()).toBe(MIGRATIONS.length);
    // 每版順序:BEGIN → DDL → PRAGMA → COMMIT
    expect(f.log[0]).toBe('BEGIN;');
    expect(f.log[1]).toContain('CREATE TABLE');
    expect(f.log[2]).toContain('PRAGMA user_version = 1');
    expect(f.log[3]).toBe('COMMIT;');
  });

  it('已是最新版 → 冪等 no-op', async () => {
    const f = makeFakeDb(MIGRATIONS.length);
    const applied = await applyMigrations(f.db);
    expect(applied).toBe(0);
    expect(f.log).toEqual([]);
  });

  it('中途失敗 → ROLLBACK 且版號停在已提交版本', async () => {
    const f = makeFakeDb(0, 'idx_txns_date');
    await expect(applyMigrations(f.db)).rejects.toThrow('boom');
    expect(f.version()).toBe(1); // v1 已提交保留,v2 回滾
    expect(f.log[f.log.length - 1]).toBe('ROLLBACK;');
  });

  it('DDL 內容:v1=accounts…v6=budgets、v7=recurring、v8=notification_drafts、v9=載具', () => {
    expect(MIGRATIONS[0]).toContain('CREATE TABLE IF NOT EXISTS accounts');
    expect(MIGRATIONS[1]).toContain('CREATE TABLE IF NOT EXISTS transactions');
    expect(MIGRATIONS[1]).toContain('idx_txns_date');
    expect(MIGRATIONS[2]).toContain('CREATE TABLE IF NOT EXISTS loans');
    expect(MIGRATIONS[2]).toContain('annualRateMilliPercent');
    expect(MIGRATIONS[3]).toContain('CREATE TABLE IF NOT EXISTS invoices');
    expect(MIGRATIONS[3]).toContain('idx_invoices_term');
    expect(MIGRATIONS[3]).toContain('CREATE TABLE IF NOT EXISTS prize_numbers');
    expect(MIGRATIONS[4]).toContain('CREATE TABLE IF NOT EXISTS assets');
    expect(MIGRATIONS[4]).toContain('CREATE TABLE IF NOT EXISTS asset_valuations');
    expect(MIGRATIONS[4]).toContain('idx_valuations_asset');
    expect(MIGRATIONS[5]).toContain('CREATE TABLE IF NOT EXISTS budgets');
    expect(MIGRATIONS[6]).toContain('CREATE TABLE IF NOT EXISTS recurring');
    expect(MIGRATIONS[6]).toContain('lastHandledMonth');
    expect(MIGRATIONS[7]).toContain('CREATE TABLE IF NOT EXISTS notification_drafts');
    expect(MIGRATIONS[7]).toContain('rawText');
    expect(MIGRATIONS[8]).toContain('ALTER TABLE invoices ADD COLUMN source');
    expect(MIGRATIONS[8]).toContain("DEFAULT 'manual'");
    expect(MIGRATIONS[8]).toContain('CREATE TABLE IF NOT EXISTS carrier_settings');
  });
});
