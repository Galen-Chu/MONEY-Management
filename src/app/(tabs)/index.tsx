/**
 * 今天分頁(P2 現金流管理 + P6 通知管理批次一):月份導覽(歷史瀏覽)+ 當月收支摘要
 * + 交易(依日分組,最新在上)+ 備註搜尋(跨全部月份)+ 定期/通知「待確認」卡
 * + 「貼上通知解析」(剪貼簿 → 草稿;必經確認才入帳)+ 右下「記一筆」鈕。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';

import { TxnRow } from '../../components/ledger/txn-row';
import { TxnSheet } from '../../components/ledger/txn-sheet';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { categoryLabelKey } from '../../domain/categories';
import { draftPreset, type NotificationDraft } from '../../domain/notification';
import { dueDateOf, isDue } from '../../domain/recurring';
import { groupByDate, monthOf, monthTotals, shiftMonth, todayKey, type Txn } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { formatDayLabel, formatMonthLabel } from '../../i18n/format';
import { useLedgerStore } from '../../state/ledgerStore';
import { useNotificationStore, type NotificationAddErrorCode } from '../../state/notificationStore';
import { useRecurringStore } from '../../state/recurringStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

function pasteErrKey(code: NotificationAddErrorCode): string {
  return code === 'repo' ? 'common.retryLater' : `notify.err${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const accounts = useLedgerStore((s) => s.accounts);
  const txns = useLedgerStore((s) => s.txns);
  const recurringItems = useRecurringStore((s) => s.items);
  const confirmRecurring = useRecurringStore((s) => s.confirm);
  const skipRecurring = useRecurringStore((s) => s.skipThisMonth);
  const drafts = useNotificationStore((s) => s.drafts);
  const addFromText = useNotificationStore((s) => s.addFromText);
  const removeDraft = useNotificationStore((s) => s.removeDraft);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);
  const [draftEditing, setDraftEditing] = useState<NotificationDraft | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => monthOf(todayKey()));
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const draftPresetValue = useMemo(() => (draftEditing ? draftPreset(draftEditing) : null), [draftEditing]);

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

  const asOf = todayKey();
  const thisMonth = monthOf(asOf);
  const pending = recurringItems.filter((r) => isDue(r, asOf));

  async function pasteAndParse() {
    setPasteError(null);
    let text = '';
    try {
      text = await Clipboard.getStringAsync();
    } catch {
      setPasteError(t('notify.errClipboard'));
      return;
    }
    const res = await addFromText(text);
    if (!res.ok) setPasteError(t(pasteErrKey(res.code)));
  }

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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notify.paste')}
          onPress={() => void pasteAndParse()}
          style={styles.pasteBtn}
        >
          <Text style={styles.pasteText}>{t('notify.paste')}</Text>
        </Pressable>
        {pasteError ? <Text style={styles.pasteErr}>{pasteError}</Text> : null}

        {pending.length > 0 ? (
          <View style={styles.recurringCard}>
            <Text style={styles.recurringTitle}>{t('recurring.pendingTitle')}</Text>
            {pending.map((r) => (
              <View key={r.id} style={styles.recurringRow}>
                <View style={styles.recurringMain}>
                  <Text style={styles.recurringNote}>{r.note.trim() || t(categoryLabelKey(r.category))}</Text>
                  <Text style={styles.recurringSub}>
                    {formatDayLabel(dueDateOf(r, thisMonth), lang)} · {nameOf(r.accountId)}
                  </Text>
                </View>
                <Text style={[styles.recurringAmount, r.type === 'expense' && { color: color.expense }]}>
                  {r.type === 'expense' ? '−' : '+'}
                  {formatCents(r.amountCents, lang)}
                </Text>
                <View style={styles.recurringActions}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.recurringConfirmBtn}
                    onPress={() => void confirmRecurring(r.id)}
                  >
                    <Text style={styles.recurringConfirmText}>{t('recurring.confirm')}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void skipRecurring(r.id)} hitSlop={6}>
                    <Text style={styles.recurringSkipText}>{t('recurring.skip')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {drafts.length > 0 ? (
          <View style={styles.notifyCard}>
            <Text style={styles.notifyTitle}>{t('notify.pendingTitle')}</Text>
            {drafts.map((d) => (
              <View key={d.id} style={styles.notifyRow}>
                <View style={styles.notifyMain}>
                  <Text style={styles.notifyNote}>{d.merchant ?? d.sender ?? t('notify.sourceSms')}</Text>
                  <Text style={styles.notifySub}>
                    {d.date ? formatDayLabel(d.date, lang) : t('notify.noDate')}
                    {d.cardLast4 ? ` · ${t('notify.cardLast4', { digits: d.cardLast4 })}` : ''}
                  </Text>
                </View>
                <Text style={[styles.notifyAmount, { color: color.expense }]}>
                  −{formatCents(d.amountCents ?? 0, lang)}
                </Text>
                <View style={styles.notifyActions}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.notifyConfirmBtn}
                    onPress={() => {
                      setDraftEditing(d);
                      setSheetVisible(true);
                    }}
                  >
                    <Text style={styles.notifyConfirmText}>{t('notify.toTxn')}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void removeDraft(d.id)} hitSlop={6}>
                    <Text style={styles.notifySkipText}>{t('notify.skip')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

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
                    setDraftEditing(null);
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
          setDraftEditing(null);
          setSheetVisible(true);
        }}
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
      >
        <Icon name="plus" size={24} fill={color.onBrand} />
      </Pressable>

      <TxnSheet
        visible={sheetVisible}
        onClose={() => {
          setSheetVisible(false);
          setEditing(null);
          setDraftEditing(null);
        }}
        initial={editing}
        preset={draftPresetValue}
        onSaved={() => {
          if (draftEditing) void removeDraft(draftEditing.id);
        }}
      />
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
  pasteBtn: {
    alignSelf: 'flex-start',
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.info,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pasteText: {
    fontSize: font.size.small,
    color: color.info,
    fontFamily: font.family.semibold,
  },
  pasteErr: {
    fontSize: font.size.small,
    color: color.danger,
  },
  notifyCard: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.info,
    padding: 14,
    gap: 10,
  },
  notifyTitle: {
    fontSize: font.size.small,
    color: color.info,
    fontFamily: font.family.bold,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifyMain: {
    flex: 1,
    gap: 2,
  },
  notifyNote: {
    fontSize: font.size.body,
    color: color.ink,
    fontFamily: font.family.semibold,
  },
  notifySub: {
    fontSize: font.size.tiny,
    color: color.inkSecondary,
  },
  notifyAmount: {
    fontSize: font.size.body,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  notifyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifyConfirmBtn: {
    backgroundColor: color.info,
    borderRadius: radius.button,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  notifyConfirmText: {
    color: color.onBrand,
    fontSize: font.size.small,
    fontFamily: font.family.bold,
  },
  notifySkipText: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontFamily: font.family.semibold,
  },
  recurringCard: {
    backgroundColor: color.accentSoft,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.accent,
    padding: 14,
    gap: 10,
  },
  recurringTitle: {
    fontSize: font.size.small,
    color: color.accentDeep,
    fontFamily: font.family.bold,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recurringMain: {
    flex: 1,
    gap: 2,
  },
  recurringNote: {
    fontSize: font.size.body,
    color: color.ink,
    fontFamily: font.family.semibold,
  },
  recurringSub: {
    fontSize: font.size.tiny,
    color: color.inkSecondary,
  },
  recurringAmount: {
    fontSize: font.size.body,
    color: color.income,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  recurringActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recurringConfirmBtn: {
    backgroundColor: color.accent,
    borderRadius: radius.button,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recurringConfirmText: {
    color: color.onBrand,
    fontSize: font.size.small,
    fontFamily: font.family.bold,
  },
  recurringSkipText: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontFamily: font.family.semibold,
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
