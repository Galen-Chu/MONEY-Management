/**
 * 發票分頁:期別導覽(‹ ›)→ 本期中獎號碼卡(未載入可下載,來源=稅務入口網公告)
 * + 載具卡(綁定/同步本期——P5)→ 我的發票(該期號碼列表,自動比對中獎徽章與金額;
 * 載具發票標來源、可「轉為交易」)+ 中獎總額 + 新增鈕。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CarrierSheet } from '../../components/ledger/carrier-sheet';
import { InvoiceSheet } from '../../components/ledger/invoice-sheet';
import { TxnSheet, type TxnPreset } from '../../components/ledger/txn-sheet';
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
import { todayKey } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { monthLabel, termPeriodInfo } from '../../i18n/format';
import { useCarrierStore, type CarrierSyncCode } from '../../state/carrierStore';
import { useInvoiceStore } from '../../state/invoiceStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { font, radius, useStyles, type ThemeColors } from '../../theme';

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

const CARD_LABEL_KEYS: Record<string, string> = {
  '3J0002': 'carrier.typePhone',
  '1K0001': 'carrier.typeEasy',
  '1H0001': 'carrier.typeIpass',
};

function syncErrKey(code: CarrierSyncCode): string {
  return `carrier.err${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

/** 載具發票 → TxnSheet 預填(分類預設 other,確認前可改) */
function presetOfInvoice(inv: Invoice): TxnPreset {
  return {
    date: inv.date ?? todayKey(),
    amountCents: inv.amountCents ?? 0,
    note: (inv.sellerName ?? '').trim(),
    category: 'other',
  };
}

export default function InvoiceScreen({ initialTerm }: { initialTerm?: InvoiceTerm }) {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const invoices = useInvoiceStore((s) => s.invoices);
  const prizesMap = useInvoiceStore((s) => s.prizes);
  const prizeLoadingTerm = useInvoiceStore((s) => s.prizeLoadingTerm);
  const loadPrizes = useInvoiceStore((s) => s.loadPrizes);
  const carrierSettings = useCarrierStore((s) => s.settings);
  const carrierSyncing = useCarrierStore((s) => s.syncing);
  const lastSync = useCarrierStore((s) => s.lastSync);
  const syncTerm = useCarrierStore((s) => s.syncTerm);

  const [term, setTerm] = useState(() => initialTerm ?? latestDrawnTerm());
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [carrierFormVisible, setCarrierFormVisible] = useState(false);
  const [txnVisible, setTxnVisible] = useState(false);
  const [txnPresetValue, setTxnPresetValue] = useState<TxnPreset | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function doSync() {
    setSyncError(null);
    const res = await syncTerm(term);
    if (!res.ok) setSyncError(t(syncErrKey(res.code)));
  }

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
            <Icon name="arrowLeft" size={16} fill={c.inkSecondary} />
          </Pressable>
          <Text style={styles.termText}>{termText}</Text>
          <Pressable accessibilityRole="button" onPress={() => setTerm((x) => shiftTerm(x, 1))} style={styles.termBtn}>
            <Icon name="arrowRight" size={16} fill={c.inkSecondary} />
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

        <View style={styles.carrierCard}>
          <View style={styles.carrierHead}>
            <Text style={styles.carrierTitle}>{t('carrier.title')}</Text>
            {carrierSettings ? (
              <Pressable accessibilityRole="button" onPress={() => setCarrierFormVisible(true)} hitSlop={6}>
                <Text style={styles.carrierEdit}>{t('common.edit')}</Text>
              </Pressable>
            ) : null}
          </View>
          {carrierSettings ? (
            <>
              <Text style={styles.carrierInfo}>
                {t(CARD_LABEL_KEYS[carrierSettings.cardType] ?? 'carrier.title')} · {carrierSettings.cardNo}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('carrier.sync')}
                disabled={carrierSyncing}
                onPress={() => void doSync()}
                style={styles.syncBtn}
              >
                <Text style={styles.syncText}>{carrierSyncing ? t('carrier.syncing') : t('carrier.sync')}</Text>
              </Pressable>
              {lastSync && lastSync.term === term && !syncError ? (
                <Text style={styles.syncResult}>{t('carrier.result', { added: lastSync.added })}</Text>
              ) : null}
              {syncError ? <Text style={styles.syncErr}>{syncError}</Text> : null}
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('carrier.setup')}
              onPress={() => setCarrierFormVisible(true)}
              style={styles.syncBtn}
            >
              <Text style={styles.syncText}>{t('carrier.setup')}</Text>
            </Pressable>
          )}
          <Text style={styles.carrierHint}>{t('carrier.hint')}</Text>
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
                {invoice.source === 'carrier' ? (
                  <Text style={styles.invoiceNote}>
                    {t('carrier.badge')}
                    {invoice.sellerName ? ` · ${invoice.sellerName}` : ''}
                    {invoice.amountCents != null ? ` · ${formatCents(invoice.amountCents, lang)}` : ''}
                  </Text>
                ) : invoice.note ? (
                  <Text style={styles.invoiceNote}>{invoice.note}</Text>
                ) : null}
              </View>
              {invoice.source === 'carrier' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('carrier.toTxn')}
                  onPress={() => {
                    setTxnPresetValue(presetOfInvoice(invoice));
                    setTxnVisible(true);
                  }}
                  style={styles.toTxnBtn}
                >
                  <Text style={styles.toTxnText}>{t('carrier.toTxn')}</Text>
                </Pressable>
              ) : null}
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
        <Icon name="plus" size={14} fill={c.onBrand} />
        <Text style={styles.addText}>{t('invoice.add')}</Text>
      </Pressable>

      <InvoiceSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        initial={editing}
        term={term}
      />

      <CarrierSheet visible={carrierFormVisible} onClose={() => setCarrierFormVisible(false)} />

      <TxnSheet visible={txnVisible} onClose={() => setTxnVisible(false)} initial={null} preset={txnPresetValue} />
    </View>
  );
}

function PrizeRow({ label, numbers, strong }: { label: string; numbers: string[]; strong?: boolean }) {
  const { styles } = useStyles(makeStyles);
  return (
    <View style={styles.prizeRow}>
      <Text style={styles.prizeLabel}>{label}</Text>
      <Text style={[styles.prizeNumbers, strong && styles.prizeNumbersStrong]}>{numbers.join('　')}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: c.bg,
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
    color: c.ink,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  termText: {
    fontSize: font.size.h2,
    color: c.ink,
    fontFamily: font.family.bold,
  },
  prizeCard: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: c.ink,
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
    color: c.inkSecondary,
  },
  prizeNumbers: {
    fontSize: font.size.small,
    color: c.ink,
    fontFamily: font.family.medium,
    fontVariant: ['tabular-nums'],
  },
  prizeNumbersStrong: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
  },
  source: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
  },
  hint: {
    fontSize: font.size.small,
    color: c.inkSecondary,
  },
  downloadBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: c.accentSoft,
    borderWidth: 1,
    borderColor: c.accent,
  },
  downloadText: {
    color: c.accentDeep,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  carrierCard: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.info,
    padding: 14,
    gap: 10,
  },
  carrierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carrierTitle: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: c.info,
  },
  carrierEdit: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.semibold,
  },
  carrierInfo: {
    fontSize: font.size.body,
    color: c.ink,
    fontFamily: font.family.semibold,
  },
  syncBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: c.accentSoft,
    borderWidth: 1,
    borderColor: c.accent,
  },
  syncText: {
    color: c.accentDeep,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  syncResult: {
    fontSize: font.size.small,
    color: c.inkSecondary,
  },
  syncErr: {
    fontSize: font.size.small,
    color: c.danger,
  },
  carrierHint: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
  },
  toTxnBtn: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.info,
    borderRadius: radius.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toTxnText: {
    color: c.info,
    fontSize: font.size.small,
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
    color: c.ink,
  },
  winTotal: {
    fontSize: font.size.h2,
    color: c.income,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    padding: 14,
    gap: 12,
  },
  invoiceMain: {
    flex: 1,
    gap: 2,
  },
  invoiceNumber: {
    fontSize: font.size.h2,
    color: c.ink,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  invoiceNote: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
  },
  badge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  badgeTier: {
    fontSize: font.size.tiny,
    color: c.income,
    fontFamily: font.family.bold,
  },
  badgeAmount: {
    fontSize: font.size.body,
    color: c.income,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  noWin: {
    fontSize: font.size.h2,
    color: c.inkMuted,
  },
  addBtn: {
    position: 'absolute',
    right: 20,
    backgroundColor: c.accent,
    borderRadius: radius.button,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 6,
    shadowColor: c.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  addText: {
    color: c.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
