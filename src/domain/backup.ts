/**
 * 備份領域(P0.8,純函式):資料快照的組裝/序列化/解析驗證。
 * 檔案 IO 平台差異在 data/backup-io(.native).ts;本層不含副作用。
 * 版本策略:version > BACKUP_VERSION → 拒絕(向前不相容);同版以前欄位只增不刪。
 */
import type { Account, Txn } from './ledger';
import type { Loan } from './loan';

export const BACKUP_VERSION = 1;

export interface BackupData {
  app: 'moneycare';
  version: number;
  /** ISO 8601 */
  exportedAt: string;
  accounts: Account[];
  txns: Txn[];
  loans: Loan[];
}

export function buildBackupData(accounts: Account[], txns: Txn[], loans: Loan[], now: Date = new Date()): BackupData {
  return {
    app: 'moneycare',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    accounts: accounts.map((a) => ({ ...a })),
    txns: txns.map((t) => ({ ...t })),
    loans: loans.map((l) => ({ ...l })),
  };
}

/** 備份檔名:moneycare-backup-YYYYMMDD-HHmm.json(本地時區) */
export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `moneycare-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** 序列化(鍵序即組裝順序,檔案內容穩定) */
export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data);
}

export type BackupParseError = 'format' | 'version';

export type BackupParseResult = { ok: true; data: BackupData } | { ok: false; error: BackupParseError };

const TXN_TYPES: readonly string[] = ['expense', 'income', 'transfer'];
const ACCOUNT_TYPES: readonly string[] = ['cash', 'bank', 'credit'];
const LOAN_TYPES: readonly string[] = ['mortgage', 'car', 'personal', 'student', 'other'];
const LOAN_METHODS: readonly string[] = ['annuity', 'principal'];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): boolean {
  return typeof v === 'string';
}

function int(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function strOrNull(v: unknown): boolean {
  return v === null || typeof v === 'string';
}

function oneOf(v: unknown, set: readonly string[]): boolean {
  return typeof v === 'string' && set.includes(v);
}

/** 解析並結構驗證備份檔;格式壞 → format、版本過新 → version */
export function parseBackup(text: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'format' };
  }
  if (!isObj(raw) || raw.app !== 'moneycare' || !Array.isArray(raw.accounts) || !Array.isArray(raw.txns) || !Array.isArray(raw.loans)) {
    return { ok: false, error: 'format' };
  }
  if (!int(raw.version) || raw.version < 1 || raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'version' };
  }
  if (!str(raw.exportedAt)) {
    return { ok: false, error: 'format' };
  }
  for (const a of raw.accounts) {
    if (!isObj(a) || !str(a.id) || !str(a.name) || !oneOf(a.type, ACCOUNT_TYPES) || !int(a.initialCents) || !int(a.createdAt)) {
      return { ok: false, error: 'format' };
    }
  }
  for (const t of raw.txns) {
    if (
      !isObj(t) || !str(t.id) || !str(t.date) || !oneOf(t.type, TXN_TYPES) || !int(t.amountCents) ||
      !strOrNull(t.category) || !str(t.accountId) || !strOrNull(t.toAccountId) || !str(t.note) ||
      !int(t.createdAt) || !int(t.updatedAt)
    ) {
      return { ok: false, error: 'format' };
    }
  }
  for (const l of raw.loans) {
    if (
      !isObj(l) || !str(l.id) || !str(l.name) || !oneOf(l.type, LOAN_TYPES) || !int(l.principalCents) ||
      !int(l.annualRateMilliPercent) || !int(l.termMonths) || !str(l.startDate) || !oneOf(l.method, LOAN_METHODS) ||
      !int(l.graceMonths) || !int(l.createdAt) || !int(l.updatedAt)
    ) {
      return { ok: false, error: 'format' };
    }
  }
  return { ok: true, data: raw as unknown as BackupData };
}
