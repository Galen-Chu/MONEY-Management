/**
 * 帳戶分頁:淨值卡(總資產/總負債/淨值)+ 帳戶卡列表(名稱/類型/餘額)
 * + 新增帳戶;點卡編輯(含刪除,引用中會被擋)。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AccountSheet } from '../../components/ledger/account-sheet';
import { EmptyState } from '../../components/ui/empty-state';
import { accountBalance, netWorth, type Account } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { useLedgerStore } from '../../state/ledgerStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

const TYPE_KEY: Record<Account['type'], string> = {
  cash: 'accounts.typeCash',
  bank: 'accounts.typeBank',
  credit: 'accounts.typeCredit',
};

export default function AccountsScreen() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const accounts = useLedgerStore((s) => s.accounts);
  const txns = useLedgerStore((s) => s.txns);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const worth = useMemo(() => netWorth(accounts, txns), [accounts, txns]);
  const balances = useMemo(
    () => accounts.map((a) => ({ account: a, cents: accountBalance(a, txns) })),
    [accounts, txns]
  );

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('accounts.title')}</Text>

        <View style={styles.worthCard}>
          <Text style={styles.netLabel}>{t('accounts.netWorth')}</Text>
          <Text style={[styles.netValue, worth.netCents < 0 && { color: color.expense }]}>
            {formatCents(worth.netCents, lang)}
          </Text>
          <View style={styles.worthRow}>
            <View style={styles.worthCell}>
              <Text style={styles.worthCellLabel}>{t('accounts.totalAssets')}</Text>
              <Text style={[styles.worthCellValue, { color: color.income }]}>{formatCents(worth.assetsCents, lang)}</Text>
            </View>
            <View style={styles.worthDivider} />
            <View style={styles.worthCell}>
              <Text style={styles.worthCellLabel}>{t('accounts.totalDebts')}</Text>
              <Text style={[styles.worthCellValue, { color: color.expense }]}>{formatCents(-worth.debtsCents, lang)}</Text>
            </View>
          </View>
        </View>

        {balances.length === 0 ? (
          <EmptyState emoji="🏦" title={t('accounts.emptyTitle')} body={t('accounts.emptyBody')} />
        ) : (
          balances.map(({ account, cents }) => (
            <Pressable
              key={account.id}
              accessibilityRole="button"
              onPress={() => {
                setEditing(account);
                setSheetVisible(true);
              }}
              style={({ pressed }) => [styles.accountCard, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.accountMain}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountType}>{t(TYPE_KEY[account.type])}</Text>
              </View>
              <Text style={[styles.accountBalance, cents < 0 && { color: color.expense }]}>
                {formatCents(cents, lang)}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('accounts.add')}
        onPress={() => {
          setEditing(null);
          setSheetVisible(true);
        }}
        style={styles.addBtn}
      >
        <Text style={styles.addText}>＋ {t('accounts.add')}</Text>
      </Pressable>

      <AccountSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} initial={editing} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 10,
  },
  title: {
    fontSize: font.size.title,
    fontWeight: '700',
    color: color.ink,
  },
  worthCard: {
    backgroundColor: color.accent,
    borderRadius: radius.card,
    padding: 18,
    gap: 12,
  },
  netLabel: {
    fontSize: font.size.small,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  netValue: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  worthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  worthCell: {
    flex: 1,
    gap: 2,
  },
  worthCellLabel: {
    fontSize: font.size.tiny,
    color: 'rgba(255,255,255,0.75)',
  },
  worthCellValue: {
    fontSize: font.size.body,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  worthDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.row,
    padding: 14,
    gap: 12,
  },
  accountMain: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    fontSize: font.size.h2,
    fontWeight: '600',
    color: color.ink,
  },
  accountType: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  accountBalance: {
    fontSize: font.size.h2,
    fontWeight: '700',
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  addBtn: {
    position: 'absolute',
    right: 20,
    bottom: 96,
    backgroundColor: color.accent,
    borderRadius: radius.button,
    paddingHorizontal: 18,
    paddingVertical: 13,
    elevation: 6,
    shadowColor: '#26251F',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  addText: {
    color: '#FFFFFF',
    fontSize: font.size.body,
    fontWeight: '700',
  },
});
