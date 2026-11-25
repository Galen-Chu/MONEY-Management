/** 通知解析 golden:各銀行制式(金額/末四碼/日期/商家/寄件方)+ 邊界(空、無金額、跨年回推、無效日期、整卡明碼)。 */
import { draftPreset, parseNotification, type NotificationDraft } from '../notification';
import { todayKey } from '../ledger';

const AS_OF = '2026-11-25';

describe('parseNotification 消費簡訊解析', () => {
  it('台新制式:【銀行】於…在商店消費+新台幣+末4碼', () => {
    const r = parseNotification('【台新銀行】您於11/24 14:05在統一超商消費,新台幣1,234元,卡號末4碼5678', AS_OF);
    expect(r).toEqual({
      ok: true,
      parsed: { amountCents: 123400, date: '2026-11-24', merchant: '統一超商', sender: '台新銀行', cardLast4: '5678' },
    });
  });

  it('國泰制式:欄位式(卡號/商店名稱/金額NT$)', () => {
    const r = parseNotification(
      '【國泰世華】信用卡消費通知:卡號4321,時間11/25 09:30,商店名稱:全家便利商店,金額NT$150',
      AS_OF
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.amountCents).toBe(15000);
    expect(r.parsed.date).toBe('2026-11-25');
    expect(r.parsed.merchant).toBe('全家便利商店');
    expect(r.parsed.cardLast4).toBe('4321');
    expect(r.parsed.sender).toBe('國泰世華');
  });

  it('中信制式:括號末4碼+消費NT$(商家不落地→null,sender 為 fallback)', () => {
    const r = parseNotification('【中國信託】您的信用卡(末4碼1234)於11/25 13:05消費NT$2,000元(蝦皮購物)', AS_OF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.amountCents).toBe(200000);
    expect(r.parsed.date).toBe('2026-11-25');
    expect(r.parsed.cardLast4).toBe('1234');
    expect(r.parsed.merchant).toBeNull();
    expect(r.parsed.sender).toBe('中國信託');
  });

  it('玉山制式:卡號末四碼…於…在…消費新台幣', () => {
    const r = parseNotification('【玉山銀行】卡號末四碼9999於11/24 12:00在蝦皮購物消費新台幣599元', AS_OF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.amountCents).toBe(59900);
    expect(r.parsed.date).toBe('2026-11-24');
    expect(r.parsed.merchant).toBe('蝦皮購物');
    expect(r.parsed.cardLast4).toBe('9999');
  });

  it('小數金額:NT$1,234.5 → 123450 分', () => {
    const r = parseNotification('消費 NT$1,234.5 元', AS_OF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.amountCents).toBe(123450);
  });

  it('空字串/純空白 → empty', () => {
    expect(parseNotification('', AS_OF)).toEqual({ ok: false, code: 'empty' });
    expect(parseNotification('   ', AS_OF)).toEqual({ ok: false, code: 'empty' });
  });

  it('無金額(繳款完成通知)→ noAmount', () => {
    expect(parseNotification('【XX銀行】您的信用卡帳款已繳款完成', AS_OF)).toEqual({ ok: false, code: 'noAmount' });
  });

  it('跨年回推:年底簡訊於年初判讀 → 去年', () => {
    const r = parseNotification('【玉山】12/30 消費 NT$100 元', '2027-01-02');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.date).toBe('2026-12-30');
  });

  it('西元全日期優先(YYYY/MM/DD)', () => {
    const r = parseNotification('2026/11/24 消費新台幣88元', AS_OF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.date).toBe('2026-11-24');
  });

  it('無效日期(13/45)→ date null,金額仍在', () => {
    const r = parseNotification('消費13/45 NT$50元', AS_OF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.amountCents).toBe(5000);
    expect(r.parsed.date).toBeNull();
  });

  it('整卡明碼不誤抓末四碼', () => {
    const r = parseNotification('卡號4321123456781234 消費新台幣100元', AS_OF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.cardLast4).toBeNull();
    expect(r.parsed.amountCents).toBe(10000);
  });
});

describe('draftPreset 草稿→TxnSheet 預填', () => {
  it('日期缺 → 今天;備註=商家;分類預設 other', () => {
    const d: NotificationDraft = {
      id: 'd1', source: 'sms', rawText: 'x', amountCents: 59900, date: null,
      merchant: '蝦皮購物', sender: '玉山銀行', cardLast4: '9999', createdAt: 1,
    };
    expect(draftPreset(d)).toEqual({ date: todayKey(), amountCents: 59900, note: '蝦皮購物', category: 'other' });
  });

  it('無商家 → 備註退回寄件方', () => {
    const d: NotificationDraft = {
      id: 'd2', source: 'sms', rawText: 'x', amountCents: 100, date: '2026-11-01',
      merchant: null, sender: '中國信託', cardLast4: null, createdAt: 1,
    };
    expect(draftPreset(d).note).toBe('中國信託');
  });
});
