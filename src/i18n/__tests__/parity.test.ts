/** zh-TW / en-US key 100% 對稱。 */
import enUS from '../locales/en-US.json';
import zhTW from '../locales/zh-TW.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

describe('i18n locale parity', () => {
  const zhKeys = flatten(zhTW).sort();
  const enKeys = flatten(enUS).sort();

  it('key 數量一致', () => {
    expect(enKeys).toEqual(zhKeys);
  });

  it('抽樣 key 存在(tabs/common/categories/accounts)', () => {
    expect(zhKeys).toContain('tabs.today');
    expect(zhKeys).toContain('common.save');
    expect(zhKeys).toContain('categories.food');
    expect(zhKeys).toContain('accounts.netWorth');
    expect(zhKeys).toContain('txn.errSameAccount');
    expect(zhKeys).toContain('settings.privacyBody');
  });
});
