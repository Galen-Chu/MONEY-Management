/** 金額領域測試:分/元轉換、Intl 格式化、輸入解析。 */
import { formatCents, fromCents, parseAmount, toCents } from '../money';

describe('money(分整數模型)', () => {
  it('元→分:整數/小數/浮點雜訊', () => {
    expect(toCents(100)).toBe(10000);
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(0.1 + 0.2)).toBe(30); // 浮點雜訊靠 Math.round 吸收
    expect(toCents(0.005)).toBe(1); // 銀行家的四捨五入之外,採 Math.round
  });

  it('分→元', () => {
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(-250)).toBe(-2.5);
  });

  it('formatCents:固定 NT$ 前綴(zh-TW ICU 本幣呈現裸 $,故不依賴貨幣符號)', () => {
    expect(formatCents(100000, 'zh-TW')).toBe('NT$1,000');
    expect(formatCents(1050, 'zh-TW')).toBe('NT$10.5');
    expect(formatCents(1050, 'en-US')).toBe('NT$10.5');
    expect(formatCents(-250, 'zh-TW')).toBe('-NT$2.5');
    expect(formatCents(0, 'zh-TW')).toBe('NT$0');
  });

  it('parseAmount:空/非數/非正數→null', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount(' 300 ')).toBe(300);
  });
});
