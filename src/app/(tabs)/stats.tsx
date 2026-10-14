/**
 * 統計分頁:月份導覽(‹ ›)→ 收/支/淨三卡 + 支出分類長條(百分比,分類色)。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../components/ui/empty-state';
import { CATEGORY_COLORS, categoryLabelKey } from '../../domain/categories';
import { categoryTotals, monthOf, monthTotals, shiftMonth, todayKey } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { formatMonthLabel } from '../../i18n/format';
import { useLedgerStore } from '../../state/ledgerStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

export default function StatsScreen() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const txns = useLedgerStore((s) => s.txns);

  const [month, setMonth] = useState(() => monthOf(todayKey()));

  const monthTxns = useMemo(() => txns.filter((x) => monthOf(x.date) === month), [txns, month]);
  const totals = useMemo(() => monthTotals(monthTxns), [monthTxns]);
  const cats = useMemo(
    () => categoryTotals(monthTxns.filter((x) => x.type === 'expense')),
    [monthTxns]
  );
  const maxCat = cats[0]?.amountCents ?? 1;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('stats.title')}</Text>

      <View style={styles.monthNav}>
        <Pressable accessibilityRole="button" onPress={() => setMonth((m) => shiftMonth(m, -1))} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthText}>{formatMonthLabel(month, lang)}</Text>
        <Pressable accessibilityRole="button" onPress={() => setMonth((m) => shiftMonth(m, 1))} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.totalsRow}>
        <TotalCell label={t('stats.income')} value={formatCents(totals.incomeCents, lang)} tone="income" />
        <TotalCell label={t('stats.expense')} value={formatCents(-totals.expenseCents, lang)} tone="expense" />
        <TotalCell
          label={t('stats.net')}
          value={formatCents(totals.netCents, lang)}
          tone={totals.netCents >= 0 ? 'income' : 'expense'}
        />
      </View>

      <Text style={styles.section}>{t('stats.byCategory')}</Text>
      {cats.length === 0 ? (
        <EmptyState emoji="🧾" title={t('stats.noData')} body="" />
      ) : (
        cats.map((c) => {
          const pct = Math.round((c.amountCents / maxCat) * 100);
          return (
            <View key={c.category} style={styles.catRow}>
              <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[c.category] }]} />
              <Text style={styles.catLabel}>{t(categoryLabelKey(c.category))}</Text>
              <View style={styles.catTrack}>
                <View style={[styles.catBar, { backgroundColor: CATEGORY_COLORS[c.category], width: `${pct}%` }]} />
              </View>
              <Text style={styles.catAmount}>{formatCents(c.amountCents, lang)}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function TotalCell({ label, value, tone }: { label: string; value: string; tone: 'expense' | 'income' }) {
  return (
    <View style={styles.totalCell}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, tone === 'expense' ? { color: color.expense } : { color: color.income }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontWeight: '700',
    color: color.ink,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  monthBtnText: {
    fontSize: 20,
    color: color.inkSecondary,
    lineHeight: 24,
  },
  monthText: {
    fontSize: font.size.h2,
    color: color.ink,
    fontWeight: '700',
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  totalCell: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.row,
    padding: 12,
    gap: 4,
  },
  totalLabel: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  totalValue: {
    fontSize: font.size.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  section: {
    fontSize: font.size.h2,
    fontWeight: '700',
    color: color.ink,
    marginTop: 8,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.surface,
    borderRadius: radius.row,
    padding: 12,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catLabel: {
    width: 64,
    fontSize: font.size.small,
    color: color.ink,
    fontWeight: '600',
  },
  catTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.track,
    overflow: 'hidden',
  },
  catBar: {
    height: 8,
    borderRadius: 4,
  },
  catAmount: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
