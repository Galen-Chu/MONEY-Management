/**
 * 帳戶明細 Sheet:餘額與本月收支小計 + 該帳戶全部交易(依日分組,最新在上)
 * + 點交易列編輯(內嵌 TxnSheet)+ 底部「編輯帳戶」鈕(交由上層開 AccountSheet)。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { accountBalance, accountMonthTotals, accountTxns, groupByDate, monthOf, todayKey, type Account, type Txn } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { formatDayLabel } from '../../i18n/format';
import { useLedgerStore } from '../../state/ledgerStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';
import { TxnRow } from './txn-row';
import { TxnSheet } from './txn-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  account: Account | null;
  onEditAccount: (account: Account) => void;
}

const TYPE_KEYS: Record<Account['type'], string> = {
  cash: 'accounts.typeCash',
  bank: 'accounts.typeBank',
  credit: 'accounts.typeCredit',
};

export function AccountDetailSheet({ visible, onClose, account, onEditAccount }: Props) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const { height } = useWindowDimensions();
  const txns = useLedgerStore((s) => s.txns);
  const accounts = useLedgerStore((s) => s.accounts);

  const [editingTxn, setEditingTxn] = useState<Txn | null>(null);
  const [txnSheetVisible, setTxnSheetVisible] = useState(false);

  const view = useMemo(() => {
    if (!account) return null;
    const all = txns; // store 陣列;帳戶編輯後 id 不變
    const current = accounts.find((a) => a.id === account.id) ?? account;
    const related = accountTxns(all, account.id);
    const groups = groupByDate(related);
    const month = monthOf(todayKey());
    const totals = accountMonthTotals(related, account.id, month);
    const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
    return { current, groups, totals, nameOf };
  }, [account, txns, accounts]);

  if (!account || !view) return null;
  const balance = accountBalance(view.current, txns);

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <ScrollView style={{ maxHeight: height * 0.8 }} contentContainerStyle={styles.wrap}>
          <Text style={styles.title}>{view.current.name}</Text>
          <Text style={styles.subtitle}>
            {t(TYPE_KEYS[view.current.type])} · {t('accounts.balance')}: {formatCents(balance, lang)}
          </Text>

          <View style={styles.summaryRow}>
            <SummaryCell label={t('today.monthExpense')} value={formatCents(-view.totals.expenseCents, lang)} tone="expense" />
            <SummaryCell label={t('today.monthIncome')} value={formatCents(view.totals.incomeCents, lang)} tone="income" />
            <SummaryCell
              label={t('today.monthNet')}
              value={formatCents(view.totals.netCents, lang)}
              tone={view.totals.netCents >= 0 ? 'income' : 'expense'}
            />
          </View>

          {view.groups.length === 0 ? (
            <Text style={styles.empty}>{t('accounts.detailEmpty')}</Text>
          ) : (
            view.groups.map((g) => (
              <View key={g.date} style={styles.day}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayDate}>{formatDayLabel(g.date, lang)}</Text>
                  {g.expenseCents > 0 ? (
                    <Text style={[styles.dayTotal, { color: color.expense }]}>−{formatCents(g.expenseCents, lang)}</Text>
                  ) : null}
                  {g.incomeCents > 0 ? (
                    <Text style={[styles.dayTotal, { color: color.income }]}>+{formatCents(g.incomeCents, lang)}</Text>
                  ) : null}
                </View>
                {g.items.map((txn) => (
                  <TxnRow
                    key={txn.id}
                    txn={txn}
                    accountName={view.nameOf}
                    onPress={(x) => {
                      setEditingTxn(x);
                      setTxnSheetVisible(true);
                    }}
                  />
                ))}
              </View>
            ))
          )}

          <Pressable
            accessibilityRole="button"
            style={styles.editBtn}
            onPress={() => {
              onClose();
              onEditAccount(view.current);
            }}
          >
            <Text style={styles.editBtnText}>{t('accounts.edit')}</Text>
          </Pressable>
        </ScrollView>
      </BottomSheet>

      <TxnSheet visible={txnSheetVisible} onClose={() => setTxnSheetVisible(false)} initial={editingTxn} />
    </>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone: 'expense' | 'income' }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, tone === 'expense' ? { color: color.expense } : { color: color.income }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  subtitle: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    marginTop: -8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cell: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 12,
    gap: 4,
  },
  cellLabel: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  cellValue: {
    fontSize: font.size.body,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: font.size.small,
    color: color.inkMuted,
    textAlign: 'center',
    paddingVertical: 18,
  },
  day: {
    gap: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  dayDate: {
    flex: 1,
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontFamily: font.family.semibold,
  },
  dayTotal: {
    fontSize: font.size.small,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  editBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.button,
    backgroundColor: color.accent,
    marginTop: 4,
  },
  editBtnText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
