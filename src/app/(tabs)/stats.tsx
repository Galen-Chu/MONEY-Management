/**
 * 統計分頁:月份導覽(‹ ›)→ 收/支/淨三卡 + 分類月預算摘要(有設預算時)
 * + 支出分類長條(有預算者顯示 用量/預算,超支轉紅)+ 現金流趨勢 + 淨值趨勢。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BudgetSheet } from '../../components/ledger/budget-sheet';
import { EmptyState } from '../../components/ui/empty-state';
import { CATEGORY_COLORS, categoryLabelKey } from '../../domain/categories';
import { budgetUsages, totalBudgetUsage } from '../../domain/budget';
import { netWorthTrend } from '../../domain/asset';
import { categoryTotals, monthOf, monthTotals, monthlyCashflow, shiftMonth, todayKey } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { formatMonthLabel } from '../../i18n/format';
import { useAssetStore } from '../../state/assetStore';
import { useBudgetStore } from '../../state/budgetStore';
import { useLedgerStore } from '../../state/ledgerStore';
import { useLoanStore } from '../../state/loanStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { font, radius, useStyles, type ThemeColors } from '../../theme';

export default function StatsScreen() {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const txns = useLedgerStore((s) => s.txns);
  const accounts = useLedgerStore((s) => s.accounts);
  const loans = useLoanStore((s) => s.loans);
  const assets = useAssetStore((s) => s.assets);
  const valuations = useAssetStore((s) => s.valuations);
  const budgets = useBudgetStore((s) => s.budgets);

  const [month, setMonth] = useState(() => monthOf(todayKey()));
  const [budgetSheetVisible, setBudgetSheetVisible] = useState(false);

  const monthTxns = useMemo(() => txns.filter((x) => monthOf(x.date) === month), [txns, month]);
  const totals = useMemo(() => monthTotals(monthTxns), [monthTxns]);
  const cats = useMemo(
    () => categoryTotals(monthTxns.filter((x) => x.type === 'expense')),
    [monthTxns]
  );
  const maxCat = cats[0]?.amountCents ?? 1;
  const totalBudget = useMemo(() => totalBudgetUsage(budgets, txns, month), [budgets, txns, month]);
  const usageByCat = useMemo(
    () => new Map(budgetUsages(budgets, txns, month).map((u) => [u.category, u])),
    [budgets, txns, month]
  );
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

      {totalBudget ? (
        <View style={styles.budgetCard}>
          <View style={styles.budgetHead}>
            <Text style={styles.budgetLabel}>{t('budgets.summary')}</Text>
            <Text style={[styles.budgetValue, totalBudget.over && { color: c.expense }]}>
              {formatCents(totalBudget.spentCents, lang)} / {formatCents(totalBudget.budgetCents, lang)}
            </Text>
          </View>
          <View style={styles.budgetTrack}>
            <View
              style={[
                styles.budgetBar,
                {
                  width: `${Math.min(100, totalBudget.pct)}%`,
                  backgroundColor: totalBudget.over ? c.expense : totalBudget.warning ? c.warning : c.accent,
                },
              ]}
            />
          </View>
          {totalBudget.over ? <Text style={styles.budgetOver}>{t('budgets.over')}</Text> : null}
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>{t('stats.byCategory')}</Text>
        <Pressable accessibilityRole="button" onPress={() => setBudgetSheetVisible(true)} style={styles.budgetEditBtn}>
          <Text style={styles.budgetEditBtnText}>{t('budgets.edit')}</Text>
        </Pressable>
      </View>
      {cats.length === 0 ? (
        <EmptyState emoji="🧾" title={t('stats.noData')} body="" />
      ) : (
        cats.map((cat) => {
          const usage = usageByCat.get(cat.category);
          const barPct = usage ? Math.min(100, usage.pct) : Math.round((cat.amountCents / maxCat) * 100);
          const barColor = usage
            ? usage.over
              ? c.expense
              : usage.warning
                ? c.warning
                : CATEGORY_COLORS[cat.category]
            : CATEGORY_COLORS[cat.category];
          return (
            <View key={cat.category} style={styles.catRow}>
              <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat.category] }]} />
              <Text style={styles.catLabel}>{t(categoryLabelKey(cat.category))}</Text>
              <View style={styles.catTrack}>
                <View style={[styles.catBar, { backgroundColor: barColor, width: `${barPct}%` }]} />
              </View>
              <Text style={[styles.catAmount, usage?.over && { color: c.expense }]}>
                {usage
                  ? `${formatCents(usage.spentCents, lang)} / ${formatCents(usage.budgetCents, lang)}`
                  : formatCents(cat.amountCents, lang)}
              </Text>
            </View>
          );
        })
      )}

      <Text style={styles.section}>{t('stats.cashflowTitle')}</Text>
      <View style={styles.flowCard}>
        <View style={styles.flowLegend}>
          <View style={[styles.flowDot, { backgroundColor: c.income }]} />
          <Text style={styles.flowLegendText}>{t('stats.income')}</Text>
          <View style={[styles.flowDot, { backgroundColor: c.expense }]} />
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
              <Text style={[styles.flowNet, m.netCents < 0 && { color: c.expense }]}>
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
              <Text style={[styles.flowNet, !positive && { color: c.expense }]}>
                {formatCents(m.netCents, lang)}
              </Text>
            </View>
          );
        })}
      </View>

      <BudgetSheet visible={budgetSheetVisible} onClose={() => setBudgetSheetVisible(false)} />
    </ScrollView>
  );
}

function TotalCell({ label, value, tone }: { label: string; value: string; tone: 'expense' | 'income' }) {
  const { c, styles } = useStyles(makeStyles);
  return (
    <View style={styles.totalCell}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, tone === 'expense' ? { color: c.expense } : { color: c.income }]}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: c.ink,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  monthBtnText: {
    fontSize: 20,
    color: c.inkSecondary,
    lineHeight: 24,
  },
  monthText: {
    fontSize: font.size.h2,
    color: c.ink,
    fontFamily: font.family.bold,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  totalCell: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radius.row,
    padding: 12,
    gap: 4,
  },
  totalLabel: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
  },
  totalValue: {
    fontSize: font.size.body,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  section: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: c.ink,
    marginTop: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.chip,
    backgroundColor: c.accentSoft,
    borderWidth: 1,
    borderColor: c.accent,
    marginTop: 8,
  },
  budgetEditBtnText: {
    fontSize: font.size.tiny,
    color: c.accentDeep,
    fontFamily: font.family.semibold,
  },
  budgetCard: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    padding: 12,
    gap: 8,
  },
  budgetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  budgetLabel: {
    fontSize: font.size.small,
    color: c.inkSecondary,
  },
  budgetValue: {
    fontSize: font.size.body,
    color: c.ink,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  budgetTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: c.track,
    overflow: 'hidden',
  },
  budgetBar: {
    height: 8,
    borderRadius: 4,
  },
  budgetOver: {
    fontSize: font.size.tiny,
    color: c.expense,
    fontFamily: font.family.semibold,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
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
    color: c.ink,
    fontFamily: font.family.semibold,
  },
  catTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.track,
    overflow: 'hidden',
  },
  catBar: {
    height: 8,
    borderRadius: 4,
  },
  catAmount: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  flowCard: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
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
    color: c.inkSecondary,
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
    color: c.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  flowBars: {
    flex: 1,
    gap: 3,
  },
  flowBarIncome: {
    height: 5,
    borderRadius: 3,
    backgroundColor: c.income,
  },
  flowBarExpense: {
    height: 5,
    borderRadius: 3,
    backgroundColor: c.expense,
  },
  flowNet: {
    width: 96,
    fontSize: font.size.tiny,
    color: c.inkSecondary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
