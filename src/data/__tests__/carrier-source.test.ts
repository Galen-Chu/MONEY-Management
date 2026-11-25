/** 載具來源測試:查詢參數 golden(同月窗/時間戳/卡別)+ swagger 範例正規化 + 錯誤對映。 */
import {
  buildCarrierQuery,
  centsOfAmount,
  fetchCarrierMonth,
  isoOfInvDate,
  normalizeCarrierDetail,
  termFromInvPeriod,
  type CarrierFetcher,
  type CarrierSettings,
} from '../carrier-source';

const SETTINGS: CarrierSettings = { cardType: '3J0002', cardNo: '/ABC.123', cardEncrypt: '9876', appID: 'APP001' };

describe('buildCarrierQuery', () => {
  it('同月查詢窗 yyyy/MM/dd、時間戳 +300 秒、v0.3 carrierInvChk 全參數', () => {
    const q = buildCarrierQuery(SETTINGS, '2026-07', new Date('2026-11-25T08:00:00Z').getTime());
    expect(q.url).toBe('https://api.einvoice.nat.gov.tw/PB2CAPIVAN/invServ/InvServ');
    expect(q.params).toEqual({
      version: '0.3',
      cardType: '3J0002',
      cardNo: '/ABC.123',
      cardEncrypt: '9876',
      action: 'carrierInvChk',
      onlyWinningInv: 'N',
      startDate: '2026/07/01',
      endDate: '2026/07/31',
      timeStamp: expect.any(String),
      expTimeStamp: expect.any(String),
      appID: 'APP001',
    });
    expect(Number(q.params.expTimeStamp) - Number(q.params.timeStamp)).toBe(300);
  });

  it('二月查詢窗照月底(閏年 29)', () => {
    const q = buildCarrierQuery(SETTINGS, '2028-02', 0);
    expect(q.params.startDate).toBe('2028/02/01');
    expect(q.params.endDate).toBe('2028/02/29');
  });
});

describe('正規化', () => {
  it('swagger 範例:民國日期物件、金額字串、雙數月期別 → 奇數起始月', () => {
    const d = normalizeCarrierDetail({
      invNum: 'EV54838339',
      cardType: '3J0002',
      cardNo: '/XCCYDHQ',
      sellerName: '台科大門市',
      invStatus: '已確認',
      amount: '81',
      invPeriod: '11206',
      invDate: { year: '112', month: '6', date: '9' },
    });
    expect(d).toEqual({
      number: 'EV54838339',
      term: '11205',
      date: '2023-06-09',
      sellerName: '台科大門市',
      amountCents: 8100,
      cardType: '3J0002',
    });
  });

  it('invPeriod 缺失 → 依日期推期別;invDate 字串型 yyyyMMdd;小寫字軌轉大寫', () => {
    const d = normalizeCarrierDetail({ invNum: 'ab12345678', invDate: '20260705', amount: 1234 });
    expect(d).toMatchObject({ number: 'AB12345678', term: '11507', date: '2026-07-05', amountCents: 123400 });
  });

  it('號碼不合格 → null', () => {
    expect(normalizeCarrierDetail({ invNum: '123', invDate: '20260705' })).toBeNull();
    expect(normalizeCarrierDetail({ invDate: '20260705' })).toBeNull();
  });

  it('termFromInvPeriod:非 5 碼/奇數月 → 日期 fallback', () => {
    expect(termFromInvPeriod('abc', '2023-06-09')).toBe('11205');
    expect(termFromInvPeriod('11207', '2023-06-09')).toBe('11205');
    expect(termFromInvPeriod('11206', null)).toBe('11205');
    expect(termFromInvPeriod('x', null)).toBeNull();
  });

  it('isoOfInvDate:物件/字串/月日越界', () => {
    expect(isoOfInvDate({ year: '115', month: '11', date: '25' })).toBe('2026-11-25');
    expect(isoOfInvDate('20261125')).toBe('2026-11-25');
    expect(isoOfInvDate('20261132')).toBeNull();
    expect(isoOfInvDate({ year: '115', month: '13', date: '1' })).toBeNull();
    expect(isoOfInvDate(null)).toBeNull();
  });

  it('centsOfAmount:千分位/小數/數字/垃圾', () => {
    expect(centsOfAmount('1,234.5')).toBe(123450);
    expect(centsOfAmount(81)).toBe(8100);
    expect(centsOfAmount('abc')).toBeNull();
    expect(centsOfAmount('0')).toBeNull();
  });
});

describe('fetchCarrierMonth', () => {
  it('code≠200 → CarrierApiError api(附 msg)', async () => {
    const fetcher: CarrierFetcher = async () => ({ code: '500', msg: 'cardNo error' });
    await expect(fetchCarrierMonth(SETTINGS, '2026-07', fetcher)).rejects.toMatchObject({ code: 'api', message: 'cardNo error' });
  });

  it('fetch 拋錯 → network', async () => {
    const fetcher: CarrierFetcher = async () => {
      throw new Error('boom');
    };
    await expect(fetchCarrierMonth(SETTINGS, '2026-07', fetcher)).rejects.toMatchObject({ code: 'network' });
  });

  it('details 正規化並過濾不合格列', async () => {
    const fetcher: CarrierFetcher = async (_url, params) => {
      expect(params.startDate).toBe('2026/07/01');
      return {
        code: '200',
        details: [
          { invNum: 'EV54838339', invPeriod: '11507', invDate: { year: '115', month: '7', date: '20' }, sellerName: '統一超商', amount: '45' },
          { invNum: 'BAD' },
        ],
      };
    };
    const list = await fetchCarrierMonth(SETTINGS, '2026-07', fetcher);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ number: 'EV54838339', term: '11507', date: '2026-07-20', sellerName: '統一超商', amountCents: 4500 });
  });

  it('details 缺漏 → 空清單', async () => {
    const fetcher: CarrierFetcher = async () => ({ code: '200' });
    expect(await fetchCarrierMonth(SETTINGS, '2026-07', fetcher)).toEqual([]);
  });
});
