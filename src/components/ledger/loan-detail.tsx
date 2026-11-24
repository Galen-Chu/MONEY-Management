/**
 * 貸款詳情 Sheet:資訊總覽(本金/利率/期數/剩餘/總利息)+ 未來 12 期攤還表
 * + 試算區(額外還本=月繳不變期數縮短;利率情境=自下期起新利率)。
 * 純展示+試算,不寫入資料;編輯/刪除走 LoanSheet。
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  nextPayment,
  outstandingCents,
  paidPeriods,
  scheduleOf,
  simulateExtraPrincipal,
  simulateRateChange,
  totalInterestCents,
  type Loan,
} from '../../domain/loan';
import { todayKey } from '../../domain/ledger';
import { formatCents, parseAmount, toCents } from '../../domain/money';
import { formatDayLabel, formatRatePercent } from '../../i18n/format';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  loan: Loan | null;
  onEdit: (loan: Loan) => void;
}

const TYPE_KEYS: Record<Loan['type'], string> = {
  mortgage: 'loans.typeMortgage',
  car: 'loans.typeCar',
  personal: 'loans.typePersonal',
  student: 'loans.typeStudent',
  other: 'loans.typeOther',
};

export function LoanDetailSheet({ visible, onClose, loan, onEdit }: Props) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const { height } = useWindowDimensions();

  const [extraText, setExtraText] = useState('');
  const [rateText, setRateText] = useState('');

  useEffect(() => {
    if (visible) {
      setExtraText('');
      setRateText('');
    }
  }, [visible]);

  const view = useMemo(() => {
    if (!loan) return null;
    const asOf = todayKey();
    const schedule = scheduleOf(loan);
    const paid = paidPeriods(loan, asOf);
    const next = nextPayment(loan, asOf);
    const upcoming = schedule.filter((p) => p.period >= paid + 1).slice(0, 12);
    return { loan, schedule, paid, next, upcoming, outstanding: outstandingCents(loan, asOf) };
  }, [loan]);

  const sims = useMemo(() => {
    if (!view || !view.next) return null;
    const at = view.paid + 1;
    const extraYuan = parseAmount(extraText);
    const extraSim = extraYuan != null ? simulateExtraPrincipal(view.loan, toCents(extraYuan), at) : null;
    const newRate = rateText.trim() && Number.isFinite(Number(rateText)) && Number(rateText) >= 0 && Number(rateText) <= 30
      ? Math.round(Number(rateText) * 1000)
      : null;
    const rateSim = newRate != null ? simulateRateChange(view.loan, newRate, at) : null;
    return { extraSim, rateSim };
  }, [view, extraText, rateText]);

  if (!loan || !view) return null;

  const { paid, next, upcoming, outstanding } = view;
  const methodLabel = t(loan.method === 'annuity' ? 'loans.methodAnnuity' : 'loans.methodPrincipal');
  const rateLabel = formatRatePercent(loan.annualRateMilliPercent, lang);
  const diffText = sims?.rateSim
    ? `${sims.rateSim.diffTotalCents >= 0 ? '+' : ''}${formatCents(sims.rateSim.diffTotalCents, lang)}`
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.78 }} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{loan.name}</Text>
        <Text style={styles.subtitle}>{t(TYPE_KEYS[loan.type])} · {methodLabel}</Text>

        <View style={styles.infoCard}>
          <InfoRow label={t('loans.principal')} value={formatCents(loan.principalCents, lang)} />
          <InfoRow label={t('loans.rate')} value={`${rateLabel}%`} />
          <InfoRow label={t('loans.term')} value={t('loans.totalPeriods', { total: loan.termMonths })} />
          <InfoRow label={t('loans.startDate')} value={loan.startDate} />
          {loan.graceMonths > 0 ? <InfoRow label={t('loans.grace')} value={t('loans.totalPeriods', { total: loan.graceMonths })} /> : null}
          <InfoRow label={t('loans.totalInterest')} value={formatCents(totalInterestCents(view.schedule), lang)} />
          <InfoRow label={t('loans.remaining')} value={formatCents(outstanding, lang)} strong />
        </View>

        {next ? (
          <>
            <Text style={styles.section}>{t('loans.schedule', { count: upcoming.length })}</Text>
            <View style={styles.infoCard}>
              {upcoming.map((p) => (
                <View key={p.period} style={styles.schedRow}>
                  <Text style={styles.schedDue}>{formatDayLabel(p.dueDate, lang)}</Text>
                  <Text style={styles.schedPay}>{formatCents(p.paymentCents, lang)}</Text>
                  <Text style={styles.schedSplit}>
                    {t('loans.interestCol')} {formatCents(p.interestCents, lang)} · {t('loans.principalCol')} {formatCents(p.principalCents, lang)}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.section}>{t('loans.simExtra')}</Text>
            <TextInput
              accessibilityLabel={t('loans.simExtraAmount')}
              style={styles.simInput}
              keyboardType="decimal-pad"
              value={extraText}
              onChangeText={setExtraText}
              placeholder={t('loans.simExtraAmount')}
              placeholderTextColor={color.inkMuted}
            />
            {sims?.extraSim ? (
              <View style={styles.simResult}>
                <Text style={styles.simLine}>{t('loans.simExtraMonths', { months: sims.extraSim.newTermMonths - paid })}</Text>
                <Text style={[styles.simLine, styles.simGood]}>{t('loans.simExtraSaved', { amount: formatCents(sims.extraSim.savedInterestCents, lang) })}</Text>
              </View>
            ) : null}

            <Text style={styles.section}>{t('loans.simRate')}</Text>
            <TextInput
              accessibilityLabel={t('loans.simRateNew')}
              style={styles.simInput}
              keyboardType="decimal-pad"
              value={rateText}
              onChangeText={setRateText}
              placeholder={t('loans.simRateNew')}
              placeholderTextColor={color.inkMuted}
            />
            {sims?.rateSim && diffText ? (
              <View style={styles.simResult}>
                <Text style={styles.simLine}>
                  {t('loans.simRateMonthly')}:{formatCents(sims.rateSim.newMonthlyCents, lang)}
                </Text>
                <Text style={[styles.simLine, sims.rateSim.diffTotalCents > 0 ? styles.simBad : styles.simGood]}>
                  {t('loans.simRateDiff', { amount: diffText })}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.paidOff}>
            <Text style={styles.paidOffText}>{t('loans.paidOff')}</Text>
          </View>
        )}

        <Pressable accessibilityRole="button" style={styles.editBtn} onPress={() => onEdit(loan)}>
          <Text style={styles.editBtnText}>{t('loans.edit')}</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoValueStrong]}>{value}</Text>
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
  infoCard: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 14,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
  },
  infoValue: {
    fontSize: font.size.small,
    color: color.ink,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  infoValueStrong: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
  },
  section: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
    marginTop: 4,
  },
  schedRow: {
    gap: 2,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  schedDue: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  schedPay: {
    fontSize: font.size.body,
    fontFamily: font.family.bold,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  schedSplit: {
    fontSize: font.size.tiny,
    color: color.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  simInput: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.body,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  simResult: {
    backgroundColor: color.accentSoft,
    borderRadius: radius.row,
    padding: 12,
    gap: 4,
  },
  simLine: {
    fontSize: font.size.small,
    color: color.ink,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  simGood: {
    color: color.accentDeep,
  },
  simBad: {
    color: color.expense,
  },
  paidOff: {
    alignItems: 'center',
    padding: 18,
  },
  paidOffText: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.accentDeep,
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
