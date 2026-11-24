/**
 * 統計分頁:月份導覽(‹ ›)→ 收/支/淨三卡 + 支出分類長條(百分比,分類色)
 * + 現金流趨勢(近 12 個月,收/支雙長條+淨額)。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../components/ui/empty-state';
import { CATEGORY_COLORS, categoryLabelKey } from '../../domain/categories';
import { netWorthTrend } from '../../domain/asset';
import { categoryTotals, monthOf, monthTotals, monthlyCashflow, shiftMonth, todayKey } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { formatMonthLabel } from '../../i18n/format';
import { useAssetStore } from '../../state/assetStore';
import { useLedgerStore } from '../../state/ledgerStore';
import { useLoanStore } from '../../state/loanStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

export default function StatsScreen() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const txns = useLedgerStore((s) => s.txns);
  const accounts = useLedgerStore((s) => s.accounts);
  const loans = useLoanStore((s) => s.loans);
  const assets = useAssetStore((s) => s.assets);
  const valuations = useAssetStore((s) => s.valuations);

  const [month, setMonth] = useState(() => monthOf(todayKey()));

  const monthTxns = useMemo(() => txns.filter((x) => monthOf(x.date) === month), [txns, month]);
  const totals = useMemo(() => monthTotals(monthTxns), [monthTxns]);
  const cats = useMemo(
    () => categoryTotals(monthTxns.filter((x) => x.type === 'expense')),
    [monthTxns]
  );
  const maxCat = cats[0]?.amountCents ?? 1;
  const cashflow = useMemo(() => monthlyCashflow(txns, month), [txns, month]);
  const maxFlow = Math.max(1, ...cashflow.map((m) => Math.max(m.incomeCents, m.expenseCents)));
  const trend = useMemo(
    () => netWorthTrend(accounts, txns, loans, assets, valuations, todayKey()),
    [accounts, txns, loans, assets, valuations]
  );
  const maxAbsNet = Math.max(1, ...trend.map((m) => Math.abs(m.netCents)));

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

      <Text style={styles.section}>{t('stats.cashflowTitle')}</Text>
      <View style={styles.flowCard}>
        <View style={styles.flowLegend}>
          <View style={[styles.flowDot, { backgroundColor: color.income }]} />
          <Text style={styles.flowLegendText}>{t('stats.income')}</Text>
          <View style={[styles.flowDot, { backgroundColor: color.expense }]} />
          <Text style={styles.flowLegendText}>{t('stats.expense')}</Text>
        </View>
        {cashflow.map((m) => {
          const incomePct = Math.round((m.incomeCents / maxFlow) * 100);
          const expensePct = Math.round((m.expenseCents / maxFlow) * 100);
          return (
            <View key={m.month} style={styles.flowRow}>
              <Text style={styles.flowMonth}>{m.month.slice(2).replace('-', '/')}</Text>
              <View style={styles.flowBars}>
                <View style={[styles.flowBarIncome, { width: `${incomePct}%` }]} />
                <View style={[styles.flowBarExpense, { width: `${expensePct}%` }]} />
              </View>
              <Text style={[styles.flowNet, m.netCents < 0 && { color: color.expense }]}>
                {formatCents(m.netCents, lang)}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.section}>{t('stats.netWorthTrendTitle')}</Text>
      <View style={styles.flowCard}>
        {trend.map((m) => {
          const pct = Math.round((Math.abs(m.netCents) / maxAbsNet) * 100);
          const positive = m.netCents >= 0;
          return (
            <View key={m.month} style={styles.flowRow}>
              <Text style={styles.flowMonth}>{m.month.slice(2).replace('-', '/')}</Text>
              <View style={styles.flowBars}>
                <View
                  style={[
                    positive ? styles.flowBarIncome : styles.flowBarExpense,
                    { width: `${pct}%` },
                  ]}
                />
              </View>
              <Text style={[styles.flowNet, !positive && { color: color.expense }]}>
                {formatCents(m.netCents, lang)}
              </Text>
            </View>
          );
        })}
      </View>
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
    fontFamily: font.family.bold,
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
    fontFamily: font.family.bold,
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
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  section: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
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
    fontFamily: font.family.semibold,
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
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  flowCard: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 14,
    gap: 8,
  },
  flowLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flowLegendText: {
    fontSize: font.size.tiny,
    color: color.inkSecondary,
    marginRight: 8,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flowMonth: {
    width: 44,
    fontSize: font.size.tiny,
    color: color.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  flowBars: {
    flex: 1,
    gap: 3,
  },
  flowBarIncome: {
    height: 5,
    borderRadius: 3,
    backgroundColor: color.income,
  },
  flowBarExpense: {
    height: 5,
    borderRadius: 3,
    backgroundColor: color.expense,
  },
  flowNet: {
    width: 96,
    fontSize: font.size.tiny,
    color: color.inkSecondary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
