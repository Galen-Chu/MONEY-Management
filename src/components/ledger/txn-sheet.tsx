/**
 * 交易表單 Sheet(新增/編輯):類型分段(支出/收入/轉帳)→ 金額(十進位輸入)
 * → 分類 chips(依類型切換;轉帳無)→ 帳戶 chips(轉帳=轉出+轉入)→ 日期(前後一天)
 * → 備註。驗證走 domain.validateTxn,錯誤碼對應 i18n(txn.err*)。
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_COLORS, categoryLabelKey } from '../../domain/categories';
import {
  shiftDate,
  todayKey,
  validateTxn,
  type Txn,
  type TxnErrorCode,
  type TxnInput,
  type TxnType,
} from '../../domain/ledger';
import { parseAmount, toCents } from '../../domain/money';
import { useLedgerStore } from '../../state/ledgerStore';
import { useSettings, currentLanguage } from '../../state/settings';
import { formatDayLabel } from '../../i18n/format';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 編輯對象(null = 新增) */
  initial: Txn | null;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: TxnType; labelKey: string }> = [
  { value: 'expense', labelKey: 'txn.typeExpense' },
  { value: 'income', labelKey: 'txn.typeIncome' },
  { value: 'transfer', labelKey: 'txn.typeTransfer' },
];

function errTextKey(code: TxnErrorCode): string {
  return `txn.err${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

export function TxnSheet({ visible, onClose, initial }: Props) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const accounts = useLedgerStore((s) => s.accounts);
  const addTxn = useLedgerStore((s) => s.addTxn);
  const updateTxn = useLedgerStore((s) => s.updateTxn);
  const deleteTxn = useLedgerStore((s) => s.deleteTxn);

  const [type, setType] = useState<TxnType>('expense');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<TxnInput['category']>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [err, setErr] = useState<TxnErrorCode | null>(null);

  // 開啟時重置(新增=空白;編輯=預填)
  useEffect(() => {
    if (!visible) return;
    setErr(null);
    if (initial) {
      setType(initial.type);
      setAmountText(initial.amountCents % 100 === 0 ? String(initial.amountCents / 100) : (initial.amountCents / 100).toFixed(2));
      setCategory(initial.category);
      setAccountId(initial.accountId);
      setToAccountId(initial.toAccountId);
      setDate(initial.date);
      setNote(initial.note);
    } else {
      setType('expense');
      setAmountText('');
      setCategory(null);
      setAccountId(accounts[0]?.id ?? null);
      setToAccountId(accounts[1]?.id ?? accounts[0]?.id ?? null);
      setDate(todayKey());
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial]);

  // 類型切換:清分類、修補帳戶選擇
  function changeType(next: TxnType) {
    setType(next);
    setCategory(null);
    if (next === 'transfer') {
      const from = accountId ?? accounts[0]?.id ?? null;
      setAccountId(from);
      setToAccountId(from ? (accounts.find((a) => a.id !== from)?.id ?? from) : null);
    }
  }

  async function save() {
    const amount = parseAmount(amountText);
    const input: TxnInput = {
      date,
      type,
      amountCents: amount != null ? toCents(amount) : 0,
      category: type === 'transfer' ? null : category,
      accountId: accountId ?? '',
      toAccountId: type === 'transfer' ? (toAccountId ?? '') : null,
      note,
    };
    const code = validateTxn(input, accounts);
    if (code) {
      setErr(code);
      return;
    }
    const ok = initial ? await updateTxn(initial.id, input) : await addTxn(input);
    if (ok) {
      onClose();
    } else {
      setErr('account');
    }
  }

  async function remove() {
    if (!initial) return;
    await deleteTxn(initial.id);
    onClose();
  }

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const errMessage = err ? t(errTextKey(err)) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{initial ? t('txn.titleEdit') : t('txn.titleAdd')}</Text>

        {/* 類型 */}
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((o) => {
            const active = o.value === type;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => changeType(o.value)}
                style={[styles.typeSeg, active && styles.typeSegActive]}
              >
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t(o.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 金額 */}
        <View style={styles.amountRow}>
          <Text style={styles.currency}>NT$</Text>
          <TextInput
            accessibilityLabel={t('txn.amount')}
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0"
            placeholderTextColor={color.inkMuted}
          />
        </View>

        {/* 分類(轉帳除外) */}
        {type !== 'transfer' ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('txn.category')}</Text>
            <View style={styles.chips}>
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={t(categoryLabelKey(c))}
                  dotColor={CATEGORY_COLORS[c]}
                  active={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* 帳戶 */}
        {type === 'transfer' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('txn.fromAccount')}</Text>
              <View style={styles.chips}>
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    active={accountId === a.id}
                    onPress={() => setAccountId(a.id)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('txn.toAccount')}</Text>
              <View style={styles.chips}>
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    active={toAccountId === a.id}
                    onPress={() => setToAccountId(a.id)}
                  />
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('txn.account')}</Text>
            <View style={styles.chips}>
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  active={accountId === a.id}
                  onPress={() => setAccountId(a.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* 日期 */}
        <View style={styles.dateRow}>
          <Pressable accessibilityLabel={t('txn.prevDay')} onPress={() => setDate((d) => shiftDate(d, -1))} style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.dateText}>{formatDayLabel(date, lang)}</Text>
          <Pressable accessibilityLabel={t('txn.nextDay')} onPress={() => setDate((d) => shiftDate(d, 1))} style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>›</Text>
          </Pressable>
        </View>

        {/* 備註 */}
        <TextInput
          accessibilityLabel={t('txn.note')}
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder={t('txn.notePlaceholder')}
          placeholderTextColor={color.inkMuted}
        />

        {errMessage ? <Text style={styles.err}>{errMessage}</Text> : null}

        <View style={styles.actions}>
          {initial ? (
            <Pressable accessibilityRole="button" style={[styles.btn, styles.btnSecondary]} onPress={remove}>
              <Text style={styles.btnSecondaryText}>{t('common.delete')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={[styles.btn, styles.btnPrimary, initial && { flex: 2 }]} onPress={save}>
            <Text style={styles.btnPrimaryText}>{t('common.save')}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

function Chip({
  label,
  dotColor,
  active,
  onPress,
}: {
  label: string;
  dotColor?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      {dotColor ? <View style={[styles.chipDot, { backgroundColor: dotColor }, active && styles.chipDotActive]} /> : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontWeight: '700',
    color: color.ink,
  },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: color.track,
    borderRadius: radius.chip,
    padding: 3,
    gap: 3,
  },
  typeSeg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.chip - 3,
  },
  typeSegActive: {
    backgroundColor: color.surface,
  },
  typeLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: color.accentDeep,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  currency: {
    fontSize: font.size.h2,
    color: color.inkMuted,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    color: color.ink,
    fontWeight: '700',
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.chip,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  chipActive: {
    borderColor: color.accent,
    backgroundColor: color.accentSoft,
  },
  chipDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  chipDotActive: {
    backgroundColor: color.accentDeep,
  },
  chipLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
  },
  chipLabelActive: {
    color: color.accentDeep,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  dateBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  dateBtnText: {
    fontSize: 20,
    color: color.inkSecondary,
    lineHeight: 24,
  },
  dateText: {
    fontSize: font.size.h2,
    color: color.ink,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  noteInput: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.body,
    color: color.ink,
  },
  err: {
    fontSize: font.size.small,
    color: color.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.button,
  },
  btnSecondary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  btnSecondaryText: {
    color: color.danger,
    fontSize: font.size.body,
    fontWeight: '600',
  },
  btnPrimary: {
    backgroundColor: color.accent,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: font.size.body,
    fontWeight: '700',
  },
});
