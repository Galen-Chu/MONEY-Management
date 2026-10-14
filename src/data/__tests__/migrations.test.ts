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

  it('DDL 內容:v1=accounts、v2=transactions', () => {
    expect(MIGRATIONS[0]).toContain('CREATE TABLE IF NOT EXISTS accounts');
    expect(MIGRATIONS[1]).toContain('CREATE TABLE IF NOT EXISTS transactions');
    expect(MIGRATIONS[1]).toContain('idx_txns_date');
  });
});
