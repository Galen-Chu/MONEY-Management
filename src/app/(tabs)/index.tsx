/**
 * 今天分頁(P2 現金流管理):月份導覽(歷史瀏覽)+ 當月收支摘要 + 交易(依日分組,最新在上)
 * + 備註搜尋(跨全部月份)+ 右下「記一筆」鈕。點交易列 → 編輯 Sheet(含刪除)。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { TxnRow } from '../../components/ledger/txn-row';
import { TxnSheet } from '../../components/ledger/txn-sheet';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { groupByDate, monthOf, monthTotals, shiftMonth, todayKey, type Txn } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { formatDayLabel, formatMonthLabel } from '../../i18n/format';
import { useLedgerStore } from '../../state/ledgerStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const accounts = useLedgerStore((s) => s.accounts);
  const txns = useLedgerStore((s) => s.txns);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);
  const [month, setMonth] = useState(() => monthOf(todayKey()));
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const monthTxns = useMemo(() => txns.filter((x) => monthOf(x.date) === month), [txns, month]);
  const searchTxns = useMemo(
    () => (q ? txns.filter((x) => x.note.toLowerCase().includes(q)).slice(0, 100) : null),
    [txns, q]
  );
  const groups = useMemo(() => groupByDate(searchTxns ?? monthTxns), [searchTxns, monthTxns]);
  const totals = useMemo(() => monthTotals(monthTxns), [monthTxns]);

  const nameOf = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? '—';
  }, [accounts]);

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hello}>{t('today.title')}</Text>

        <View style={styles.monthNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('today.prevMonth')}
            onPress={() => setMonth((m) => shiftMonth(m, -1))}
            style={styles.monthBtn}
          >
            <Icon name="arrowLeft" size={16} fill={color.inkSecondary} />
          </Pressable>
          <Text style={styles.month}>{formatMonthLabel(month, lang)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('today.nextMonth')}
            onPress={() => setMonth((m) => shiftMonth(m, 1))}
            style={styles.monthBtn}
          >
            <Icon name="arrowRight" size={16} fill={color.inkSecondary} />
          </Pressable>
        </View>

        <View style={styles.summary}>
          <SummaryCell label={t('today.monthExpense')} value={formatCents(-totals.expenseCents, lang)} tone="expense" />
          <SummaryCell label={t('today.monthIncome')} value={formatCents(totals.incomeCents, lang)} tone="income" />
          <SummaryCell label={t('today.monthNet')} value={formatCents(totals.netCents, lang)} tone={totals.netCents >= 0 ? 'income' : 'expense'} />
        </View>

        <TextInput
          accessibilityLabel={t('today.searchPlaceholder')}
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('today.searchPlaceholder')}
          placeholderTextColor={color.inkMuted}
          autoCorrect={false}
        />

        {groups.length === 0 ? (
          q ? (
            <EmptyState emoji="🔍" title={t('today.searchEmpty')} body="" />
          ) : (
            <EmptyState emoji="📒" title={t('today.emptyTitle')} body={t('today.emptyBody')} />
          )
        ) : (
          groups.map((g) => (
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
                  accountName={nameOf}
                  onPress={(x) => {
                    setEditing(x);
                    setSheetVisible(true);
                  }}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.fab')}
        onPress={() => {
          setEditing(null);
          setSheetVisible(true);
        }}
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
      >
        <Icon name="plus" size={24} fill={color.onBrand} />
      </Pressable>

      <TxnSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} initial={editing} />
    </View>
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
  shell: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 140,
    gap: 12,
  },
  hello: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  monthBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  month: {
    fontSize: font.size.small,
    color: color.inkMuted,
  },
  search: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: font.size.body,
    color: color.ink,
  },
  summary: {
    flexDirection: 'row',
    gap: 10,
  },
  cell: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.row,
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: color.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
