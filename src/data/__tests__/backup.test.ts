/** 備份編排測試(InMemory repos):collect 快照 + restore 取代表資料。 */
import {
  InMemoryAccountRepository,
  InMemoryAssetRepository,
  InMemoryInvoiceRepository,
  InMemoryLoanRepository,
  InMemoryPrizeRepository,
  InMemoryTxnRepository,
  InMemoryValuationRepository,
  type Repositories,
} from '../repository';
import { collectBackupData, restoreBackup } from '../backup';
import { buildBackupData } from '../../domain/backup';
import type { Account, Txn } from '../../domain/ledger';
import type { Loan } from '../../domain/loan';
import type { Asset, AssetValuation } from '../../domain/asset';

const accounts: Account[] = [{ id: 'a1', name: '現金', type: 'cash', initialCents: 100_000, createdAt: 1 }];
const txns: Txn[] = [
  {
    id: 't1', date: '2026-10-07', type: 'expense', amountCents: 1200, category: 'food',
    accountId: 'a1', toAccountId: null, note: '午餐', createdAt: 3, updatedAt: 3,
  },
];
const loans: Loan[] = [
  {
    id: 'l1', name: '車貸', type: 'car', principalCents: 500_000_00, annualRateMilliPercent: 3500,
    termMonths: 60, startDate: '2025-06-01', method: 'annuity', graceMonths: 0, createdAt: 4, updatedAt: 4,
  },
];

const assets: Asset[] = [{ id: 'as1', name: '自住公寓', type: 'real-estate', createdAt: 5, updatedAt: 5 }];
const valuations: AssetValuation[] = [
  { id: 'v1', assetId: 'as1', date: '2026-01-31', valueCents: 10_000_000_00, createdAt: 5 },
];

function makeRepos(seed: { seedAccounts?: Account[] }): Repositories {
  return {
    accounts: new InMemoryAccountRepository(seed.seedAccounts ?? []),
    txns: new InMemoryTxnRepository(),
    loans: new InMemoryLoanRepository(),
    invoices: new InMemoryInvoiceRepository(),
    prizes: new InMemoryPrizeRepository(),
    assets: new InMemoryAssetRepository(),
    valuations: new InMemoryValuationRepository(),
  };
}

describe('collectBackupData', () => {
  it('快照含各表與版本', () => {
    const data = collectBackupData(accounts, txns, loans, assets, valuations);
    expect(data).toMatchObject({ app: 'moneycare', version: 1 });
    expect(data.accounts).toHaveLength(1);
    expect(data.txns).toHaveLength(1);
    expect(data.loans).toHaveLength(1);
    expect(data.assets).toHaveLength(1);
    expect(data.valuations).toHaveLength(1);
  });
});

describe('restoreBackup', () => {
  it('清空舊資料後整批寫入(InMemory)', async () => {
    const repos = makeRepos({ seedAccounts: [{ id: 'old', name: '舊帳戶', type: 'bank', initialCents: 0, createdAt: 9 }] });
    await repos.txns.insert({
      id: 'old-t', date: '2026-01-01', type: 'income', amountCents: 100, category: 'salary',
      accountId: 'old', toAccountId: null, note: '', createdAt: 9, updatedAt: 9,
    });
    await repos.assets.insert({ id: 'old-as', name: '舊資產', type: 'other', createdAt: 9, updatedAt: 9 });
    await repos.valuations.insert({ id: 'old-v', assetId: 'old-as', date: '2026-01-01', valueCents: 1, createdAt: 9 });
    const backup = buildBackupData(accounts, txns, loans, assets, valuations);

    await restoreBackup(repos, backup);

    const [accs, txnList, loanList, assetList, valList] = await Promise.all([
      repos.accounts.list(),
      repos.txns.listAll(),
      repos.loans.list(),
      repos.assets.list(),
      repos.valuations.listAll(),
    ]);
    expect(accs.map((a) => a.id)).toEqual(['a1']);
    expect(txnList.map((t) => t.id)).toEqual(['t1']);
    expect(loanList.map((l) => l.id)).toEqual(['l1']);
    expect(assetList.map((a) => a.id)).toEqual(['as1']);
    expect(valList.map((v) => v.id)).toEqual(['v1']);
  });

  it('還原空備份 → 各表清空', async () => {
    const repos = makeRepos({ seedAccounts: accounts });
    await restoreBackup(repos, buildBackupData([], [], [], [], []));
    const [accs, txnList, loanList, assetList, valList] = await Promise.all([
      repos.accounts.list(),
      repos.txns.listAll(),
      repos.loans.list(),
      repos.assets.list(),
      repos.valuations.listAll(),
    ]);
    expect(accs).toHaveLength(0);
    expect(txnList).toHaveLength(0);
    expect(loanList).toHaveLength(0);
    expect(assetList).toHaveLength(0);
    expect(valList).toHaveLength(0);
  });
});
