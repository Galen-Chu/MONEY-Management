/** 備份領域測試:組裝/序列化/解析往返、結構驗證(format)、版本策略(version)、檔名。 */
import {
  BACKUP_VERSION,
  backupFileName,
  buildBackupData,
  parseBackup,
  serializeBackup,
  type BackupData,
} from '../backup';
import type { Account, Txn } from '../ledger';
import type { Loan } from '../loan';
import type { Asset, AssetValuation } from '../asset';
import type { Budget } from '../budget';

const NOW = new Date('2026-11-24T08:30:00');

const accounts: Account[] = [
  { id: 'a1', name: '現金', type: 'cash', initialCents: 100_000, createdAt: 1 },
  { id: 'a2', name: '卡', type: 'credit', initialCents: -20_000, createdAt: 2 },
];

const txns: Txn[] = [
  {
    id: 't1', date: '2026-10-07', type: 'expense', amountCents: 1200, category: 'food',
    accountId: 'a1', toAccountId: null, note: '午餐', createdAt: 3, updatedAt: 3,
  },
];

const loans: Loan[] = [
  {
    id: 'l1', name: '房貸', type: 'mortgage', principalCents: 8_000_000_000,
    annualRateMilliPercent: 2185, termMonths: 360, startDate: '2024-01-15',
    method: 'annuity', graceMonths: 36, createdAt: 4, updatedAt: 4,
  },
];

const assets: Asset[] = [{ id: 'as1', name: '自住公寓', type: 'real-estate', createdAt: 5, updatedAt: 5 }];

const valuations: AssetValuation[] = [
  { id: 'v1', assetId: 'as1', date: '2026-01-31', valueCents: 10_000_000_00, createdAt: 5 },
];

const budgets: Budget[] = [{ category: 'food', amountCents: 100_000 }];

describe('備份往返', () => {
  it('build → serialize → parse → 內容一致(深層相等、不共享參考)', () => {
    const data = buildBackupData(accounts, txns, loans, assets, valuations, budgets, NOW);
    expect(data.version).toBe(BACKUP_VERSION);
    expect(data.exportedAt).toBe(NOW.toISOString());
    const parsed = parseBackup(serializeBackup(data));
    expect(parsed).toEqual({ ok: true, data });
    // 防禦性複製:改原件不影響備份
    accounts[0]!.name = '改了';
    expect((parsed.ok ? parsed.data.accounts[0]!.name : '')).toBe('現金');
  });

  it('序列化鍵序穩定(同輸入同輸出)', () => {
    const a = serializeBackup(buildBackupData(accounts, txns, loans, assets, valuations, budgets, NOW));
    const b = serializeBackup(buildBackupData(accounts, txns, loans, assets, valuations, budgets, NOW));
    expect(a).toBe(b);
  });

  it('舊版備份(無 assets/valuations/budgets 欄位)→ 空陣列相容', () => {
    const legacy = {
      app: 'moneycare',
      version: 1,
      exportedAt: NOW.toISOString(),
      accounts,
      txns,
      loans,
    };
    const parsed = parseBackup(JSON.stringify(legacy));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.assets).toEqual([]);
      expect(parsed.data.valuations).toEqual([]);
      expect(parsed.data.budgets).toEqual([]);
    }
  });
});

describe('parseBackup 驗證', () => {
  const base = () => buildBackupData(accounts, txns, loans, assets, valuations, budgets, NOW);

  it('非 JSON → format', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'format' });
  });

  it('app 不符/缺陣列 → format', () => {
    const d1 = { ...base(), app: 'other' } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(d1))).toEqual({ ok: false, error: 'format' });
    const d2 = { ...base(), txns: {} } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(d2))).toEqual({ ok: false, error: 'format' });
  });

  it('欄位型別錯(帳戶/交易/貸款)→ format', () => {
    const badAcc = { ...base(), accounts: [{ ...accounts[0]!, initialCents: 'x' }] } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(badAcc))).toEqual({ ok: false, error: 'format' });
    const badTxn = { ...base(), txns: [{ ...txns[0]!, type: 'weird' }] } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(badTxn))).toEqual({ ok: false, error: 'format' });
    const badLoan = { ...base(), loans: [{ ...loans[0]!, graceMonths: 1.5 }] } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(badLoan))).toEqual({ ok: false, error: 'format' });
  });

  it('版本過新 → version;版本非整數 → version', () => {
    const v2 = { ...base(), version: BACKUP_VERSION + 1 } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(v2))).toEqual({ ok: false, error: 'version' });
    const vBad = { ...base(), version: '1' } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(vBad))).toEqual({ ok: false, error: 'version' });
  });

  it('資產欄位型別錯 → format', () => {
    const badAsset = { ...base(), assets: [{ ...assets[0]!, type: 'weird' }] } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(badAsset))).toEqual({ ok: false, error: 'format' });
    const badVal = {
      ...base(),
      valuations: [{ ...valuations[0]!, valueCents: 'x' }],
    } as unknown as BackupData;
    expect(parseBackup(JSON.stringify(badVal))).toEqual({ ok: false, error: 'format' });
  });
});

describe('backupFileName', () => {
  it('本地時間組成 YYYYMMDD-HHmm', () => {
    expect(backupFileName(NOW)).toBe('moneycare-backup-20261124-0830.json');
  });
});
