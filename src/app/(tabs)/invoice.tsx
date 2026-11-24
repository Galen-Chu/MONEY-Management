/**
 * 發票分頁:期別導覽(‹ ›)→ 本期中獎號碼卡(未載入可下載,來源=稅務入口網公告)
 * + 我的發票(該期號碼列表,自動比對中獎徽章與金額)+ 中獎總額 + 新增鈕。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { InvoiceSheet } from '../../components/ledger/invoice-sheet';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import {
  PRIZE_AMOUNTS_CENTS,
  latestDrawnTerm,
  matchInvoice,
  shiftTerm,
  type Invoice,
  type InvoiceTerm,
  type PrizeTier,
} from '../../domain/invoice';
import { formatCents } from '../../domain/money';
import { monthLabel, termPeriodInfo } from '../../i18n/format';
import { useInvoiceStore } from '../../state/invoiceStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

const TIER_KEYS: Record<PrizeTier, string> = {
  super: 'invoice.tierSuper',
  special: 'invoice.tierSpecial',
  first: 'invoice.tierFirst',
  second: 'invoice.tierSecond',
  third: 'invoice.tierThird',
  fourth: 'invoice.tierFourth',
  fifth: 'invoice.tierFifth',
  sixth: 'invoice.tierSixth',
  extraSixth: 'invoice.tierExtraSixth',
};

export default function InvoiceScreen({ initialTerm }: { initialTerm?: InvoiceTerm }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const invoices = useInvoiceStore((s) => s.invoices);
  const prizesMap = useInvoiceStore((s) => s.prizes);
  const prizeLoadingTerm = useInvoiceStore((s) => s.prizeLoadingTerm);
  const loadPrizes = useInvoiceStore((s) => s.loadPrizes);

  const [term, setTerm] = useState(() => initialTerm ?? latestDrawnTerm());
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const prizes = prizesMap[term];
  const periodInvoices = useMemo(() => invoices.filter((i) => i.term === term), [invoices, term]);
  const results = useMemo(
    () => periodInvoices.map((invoice) => ({ invoice, tier: prizes ? matchInvoice(invoice.number, prizes) : null })),
    [periodInvoices, prizes]
  );
  const totalWin = results.reduce((s, r) => s + (r.tier ? PRIZE_AMOUNTS_CENTS[r.tier] : 0), 0);
  const info = termPeriodInfo(term);
  const termText = t('invoice.periodLabel', {
    year: lang === 'en-US' ? info.gregYear : info.rocYear,
    from: monthLabel(info.fromMonth, lang),
    to: monthLabel(info.toMonth, lang),
  });

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('invoice.title')}</Text>

        <View style={styles.termNav}>
          <Pressable accessibilityRole="button" onPress={() => setTerm((x) => shiftTerm(x, -1))} style={styles.termBtn}>
            <Icon name="arrowLeft" size={16} fill={color.inkSecondary} />
          </Pressable>
          <Text style={styles.termText}>{termText}</Text>
          <Pressable accessibilityRole="button" onPress={() => setTerm((x) => shiftTerm(x, 1))} style={styles.termBtn}>
            <Icon name="arrowRight" size={16} fill={color.inkSecondary} />
          </Pressable>
        </View>

        <View style={styles.prizeCard}>
          <Text style={styles.cardTitle}>{t('invoice.prizes')}</Text>
          {prizes ? (
            <View style={styles.prizeList}>
              <PrizeRow label={t('invoice.tierSuper')} numbers={[prizes.superNumber]} strong />
              <PrizeRow label={t('invoice.tierSpecial')} numbers={[prizes.specialNumber]} strong />
              <PrizeRow label={t('invoice.firstLabel')} numbers={prizes.firstNumbers} strong />
              {prizes.extraNumbers.length > 0 ? (
                <PrizeRow label={t('invoice.extraLabel')} numbers={prizes.extraNumbers} />
              ) : null}
              <Text style={styles.source}>{t('invoice.source')}</Text>
            </View>
          ) : prizeLoadingTerm === term ? (
            <Text style={styles.hint}>{t('invoice.loadingPrizes')}</Text>
          ) : (
            <Pressable accessibilityRole="button" style={styles.downloadBtn} onPress={() => void loadPrizes(term)}>
              <Text style={styles.downloadText}>{t('invoice.loadPrizes')}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.winRow}>
          <Text style={styles.section}>{t('invoice.myInvoices')}</Text>
          {totalWin > 0 ? <Text style={styles.winTotal}>{formatCents(totalWin, lang)}</Text> : null}
        </View>

        {results.length === 0 ? (
          <EmptyState emoji="🧾" title={t('invoice.emptyTitle')} body={t('invoice.emptyBody')} />
        ) : (
          results.map(({ invoice, tier }) => (
            <Pressable
              key={invoice.id}
              accessibilityRole="button"
              onPress={() => {
                setEditing(invoice);
                setFormVisible(true);
              }}
              style={({ pressed }) => [styles.invoiceRow, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.invoiceMain}>
                <Text style={styles.invoiceNumber}>{invoice.number}</Text>
                {invoice.note ? <Text style={styles.invoiceNote}>{invoice.note}</Text> : null}
              </View>
              {tier ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeTier}>{t(TIER_KEYS[tier])}</Text>
                  <Text style={styles.badgeAmount}>{formatCents(PRIZE_AMOUNTS_CENTS[tier], lang)}</Text>
                </View>
              ) : (
                <Text style={styles.noWin}>—</Text>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('invoice.add')}
        onPress={() => {
          setEditing(null);
          setFormVisible(true);
        }}
        style={[styles.addBtn, { bottom: insets.bottom + 96 }]}
      >
        <Icon name="plus" size={14} fill={color.onBrand} />
        <Text style={styles.addText}>{t('invoice.add')}</Text>
      </Pressable>

      <InvoiceSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        initial={editing}
        term={term}
      />
    </View>
  );
}

function PrizeRow({ label, numbers, strong }: { label: string; numbers: string[]; strong?: boolean }) {
  return (
    <View style={styles.prizeRow}>
      <Text style={styles.prizeLabel}>{label}</Text>
      <Text style={[styles.prizeNumbers, strong && styles.prizeNumbersStrong]}>{numbers.join('　')}</Text>
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
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  termNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  termBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  termText: {
    fontSize: font.size.h2,
    color: color.ink,
    fontFamily: font.family.bold,
  },
  prizeCard: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  prizeList: {
    gap: 6,
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  prizeLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
  },
  prizeNumbers: {
    fontSize: font.size.small,
    color: color.ink,
    fontFamily: font.family.medium,
    fontVariant: ['tabular-nums'],
  },
  prizeNumbersStrong: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
  },
  source: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  hint: {
    fontSize: font.size.small,
    color: color.inkSecondary,
  },
  downloadBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderColor: color.accent,
  },
  downloadText: {
    color: color.accentDeep,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  section: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  winTotal: {
    fontSize: font.size.h2,
    color: color.income,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 14,
    gap: 12,
  },
  invoiceMain: {
    flex: 1,
    gap: 2,
  },
  invoiceNumber: {
    fontSize: font.size.h2,
    color: color.ink,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  invoiceNote: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  badge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  badgeTier: {
    fontSize: font.size.tiny,
    color: color.income,
    fontFamily: font.family.bold,
  },
  badgeAmount: {
    fontSize: font.size.body,
    color: color.income,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  noWin: {
    fontSize: font.size.h2,
    color: color.inkMuted,
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
