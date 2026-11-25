/** 通知 store:貼上解析建草稿、同文重複拒絕、無金額拒絕、移除、bootstrap 載入。 */
import { InMemoryNotificationDraftRepository } from '../../data/repository';
import { __resetForTest, useNotificationStore } from '../notificationStore';

const SMS = '【台新銀行】您於11/24 14:05在統一超商消費,新台幣1,234元,卡號末4碼5678';

function setup() {
  __resetForTest();
  const repo = new InMemoryNotificationDraftRepository();
  useNotificationStore.getState().attach(repo);
  return repo;
}

describe('notificationStore', () => {
  it('addFromText:解析成功 → 建草稿(含寫入 repo)', async () => {
    const repo = setup();
    const res = await useNotificationStore.getState().addFromText(SMS);
    expect(res).toEqual({ ok: true });
    const drafts = useNotificationStore.getState().drafts;
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.source).toBe('sms');
    expect(drafts[0]!.amountCents).toBe(123400);
    expect(drafts[0]!.merchant).toBe('統一超商');
    expect(await repo.list()).toHaveLength(1);
  });

  it('同一則重複貼上 → duplicate', async () => {
    setup();
    await useNotificationStore.getState().addFromText(SMS);
    const again = await useNotificationStore.getState().addFromText(SMS);
    expect(again).toEqual({ ok: false, code: 'duplicate' });
    expect(useNotificationStore.getState().drafts).toHaveLength(1);
  });

  it('無金額 → noAmount,不建草稿', async () => {
    setup();
    const res = await useNotificationStore.getState().addFromText('今天天氣很好');
    expect(res).toEqual({ ok: false, code: 'noAmount' });
    expect(useNotificationStore.getState().drafts).toHaveLength(0);
  });

  it('removeDraft:從 state 與 repo 移除', async () => {
    const repo = setup();
    await useNotificationStore.getState().addFromText(SMS);
    const id = useNotificationStore.getState().drafts[0]!.id;
    await useNotificationStore.getState().removeDraft(id);
    expect(useNotificationStore.getState().drafts).toHaveLength(0);
    expect(await repo.list()).toHaveLength(0);
  });

  it('bootstrap:由 repo 載入既有草稿', async () => {
    const repo = setup();
    await repo.insert({
      id: 'x', source: 'sms', rawText: 'r', amountCents: 100, date: null,
      merchant: null, sender: null, cardLast4: null, createdAt: 1,
    });
    await useNotificationStore.getState().bootstrap();
    expect(useNotificationStore.getState().drafts).toHaveLength(1);
  });
});
