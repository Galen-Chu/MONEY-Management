/**
 * 貸款分頁:總覽品牌卡(總剩餘本金/每月應繳參考/下期繳款日)
 * + 貸款卡列表(名稱/類型·利率/剩餘/月繳/已繳進度);點卡看詳情(攤還+試算)。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LoanDetailSheet } from '../../components/ledger/loan-detail';
import { LoanSheet } from '../../components/ledger/loan-sheet';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { todayKey } from '../../domain/ledger';
import type { Loan } from '../../domain/loan';
import { monthlyPaymentTotalCents, nextPayment, outstandingCents, paidPeriods, scheduleOf } from '../../domain/loan';
import { formatCents } from '../../domain/money';
import { formatDayLabel, formatRatePercent } from '../../i18n/format';
import { useLoanStore } from '../../state/loanStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

const TYPE_KEYS: Record<Loan['type'], string> = {
  mortgage: 'loans.typeMortgage',
  car: 'loans.typeCar',
  personal: 'loans.typePersonal',
  student: 'loans.typeStudent',
  other: 'loans.typeOther',
};

export default function LoansScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const loans = useLoanStore((s) => s.loans);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [detail, setDetail] = useState<Loan | null>(null);

  const asOf = todayKey();
  const summary = useMemo(() => {
    const totalOutstanding = loans.reduce((s, l) => s + outstandingCents(l, asOf), 0);
    const monthly = monthlyPaymentTotalCents(loans, asOf);
    const nextDates = loans
      .map((l) => nextPayment(l, asOf)?.dueDate)
      .filter((d): d is string => d != null)
      .sort();
    return { totalOutstanding, monthly, nextDue: nextDates[0] ?? null };
  }, [loans, asOf]);

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('loans.title')}</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.sumLabel}>{t('loans.totalOutstanding')}</Text>
          <Text style={styles.sumValue}>{formatCents(summary.totalOutstanding, lang)}</Text>
          <View style={styles.sumRow}>
            <View style={styles.sumCell}>
              <Text style={styles.sumCellLabel}>{t('loans.monthlyTotal')}</Text>
              <Text style={styles.sumCellValue}>{formatCents(summary.monthly, lang)}</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumCell}>
              <Text style={styles.sumCellLabel}>{t('loans.nextDue')}</Text>
              <Text style={styles.sumCellValue}>
                {summary.nextDue ? formatDayLabel(summary.nextDue, lang) : '—'}
              </Text>
            </View>
          </View>
        </View>

        {loans.length === 0 ? (
          <EmptyState emoji="🏠" title={t('loans.emptyTitle')} body={t('loans.emptyBody')} />
        ) : (
          loans.map((loan) => {
            const outstanding = outstandingCents(loan, asOf);
            const next = nextPayment(loan, asOf);
            const paid = paidPeriods(loan, asOf);
            const total = scheduleOf(loan).length;
            const pct = Math.min(100, Math.round((paid / total) * 100));
            return (
              <Pressable
                key={loan.id}
                accessibilityRole="button"
                onPress={() => setDetail(loan)}
                style={({ pressed }) => [styles.loanCard, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.loanMain}>
                  <Text style={styles.loanName}>{loan.name}</Text>
                  <Text style={styles.loanSub}>
                    {t(TYPE_KEYS[loan.type])} · {formatRatePercent(loan.annualRateMilliPercent, lang)}% ·{' '}
                    {t('loans.paidPeriods', { paid, total })}
                  </Text>
                  <View style={styles.track}>
                    <View style={[styles.trackBar, { width: `${pct}%` }]} />
                  </View>
                </View>
                <View style={styles.loanRight}>
                  <Text style={[styles.loanRemaining, outstanding === 0 && styles.loanPaidOff]}>
                    {outstanding === 0 ? t('loans.paidOff') : formatCents(outstanding, lang)}
                  </Text>
                  <Text style={styles.loanMonthly}>
                    {next ? formatCents(next.paymentCents, lang) : '—'}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('loans.add')}
        onPress={() => {
          setEditing(null);
          setFormVisible(true);
        }}
        style={[styles.addBtn, { bottom: insets.bottom + 96 }]}
      >
        <Icon name="plus" size={14} fill={color.onBrand} />
        <Text style={styles.addText}>{t('loans.add')}</Text>
      </Pressable>

      <LoanDetailSheet
        visible={detail != null}
        onClose={() => setDetail(null)}
        loan={detail}
        onEdit={(loan) => {
          setDetail(null);
          setEditing(loan);
          setFormVisible(true);
        }}
      />
      <LoanSheet visible={formVisible} onClose={() => setFormVisible(false)} initial={editing} />
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
    gap: 10,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  summaryCard: {
    backgroundColor: color.accent,
    borderRadius: radius.card,
    padding: 18,
    gap: 12,
  },
  sumLabel: {
    fontSize: font.size.small,
    color: color.onBrandSecondary,
    fontFamily: font.family.semibold,
  },
  sumValue: {
    fontSize: 30,
    color: color.onBrand,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sumCell: {
    flex: 1,
    gap: 2,
  },
  sumCellLabel: {
    fontSize: font.size.tiny,
    color: color.onBrandSecondary,
  },
  sumCellValue: {
    fontSize: font.size.body,
    fontFamily: font.family.bold,
    color: color.onBrand,
    fontVariant: ['tabular-nums'],
  },
  sumDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: color.onBrandSoft,
  },
  loanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.row,
    padding: 14,
    gap: 12,
  },
  loanMain: {
    flex: 1,
    gap: 4,
  },
  loanName: {
    fontSize: font.size.h2,
    fontFamily: font.family.semibold,
    color: color.ink,
  },
  loanSub: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: color.track,
    overflow: 'hidden',
    marginTop: 4,
  },
  trackBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: color.accent,
  },
  loanRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  loanRemaining: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  loanPaidOff: {
    color: color.accentDeep,
    fontSize: font.size.small,
  },
  loanMonthly: {
    fontSize: font.size.tiny,
    color: color.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  addBtn: {
    position: 'absolute',
    right: 20,
    backgroundColor: color.accent,
    borderRadius: radius.button,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 6,
    shadowColor: color.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  addText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
