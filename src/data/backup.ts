/**
 * 備份編排(Repository 介面操作,InMemory/SQLite 通用;平台 IO 見 backup-io(.native).ts):
 * 還原 = 先清空現有各表、再整批寫入(單一 API 無跨表交易,失敗時由 store error 橫幅呈現)。
 */
import { buildBackupData, type BackupData } from '../domain/backup';
import type { Account, Txn } from '../domain/ledger';
import type { Loan } from '../domain/loan';
import type { Asset, AssetValuation } from '../domain/asset';
import type { Budget } from '../domain/budget';
import type { Repositories } from './repository';

export function collectBackupData(
  accounts: Account[],
  txns: Txn[],
  loans: Loan[],
  assets: Asset[],
  valuations: AssetValuation[],
  budgets: Budget[]
): BackupData {
  return buildBackupData(accounts, txns, loans, assets, valuations, budgets);
}

/** 還原:清空現有資料後整批寫入備份內容 */
export async function restoreBackup(repos: Repositories, data: BackupData): Promise<void> {
  const [accs, txns, loans, assets, budgets] = await Promise.all([
    repos.accounts.list(),
    repos.txns.listAll(),
    repos.loans.list(),
    repos.assets.list(),
    repos.budgets.list(),
  ]);
  await Promise.all([
    ...accs.map((a) => repos.accounts.remove(a.id)),
    ...txns.map((t) => repos.txns.remove(t.id)),
    ...loans.map((l) => repos.loans.remove(l.id)),
    ...assets.map((a) => repos.valuations.removeByAsset(a.id)),
    ...assets.map((a) => repos.assets.remove(a.id)),
    ...budgets.map((b) => repos.budgets.remove(b.category)),
  ]);
  await Promise.all([
    ...data.accounts.map((a) => repos.accounts.insert(a)),
    ...data.txns.map((t) => repos.txns.insert(t)),
    ...data.loans.map((l) => repos.loans.insert(l)),
    ...data.assets.map((a) => repos.assets.insert(a)),
    ...data.valuations.map((v) => repos.valuations.insert(v)),
    ...data.budgets.map((b) => repos.budgets.upsert(b)),
  ]);
}
