/**
 * 定期交易表單 Sheet(新增/編輯):類型(支出/收入)、金額、分類 chips(隨類型切換)、
 * 帳戶 chips、每月日(1-31,月底夾斷)、備註。驗證走 domain.validateRecurring。
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryLabelKey } from '../../domain/categories';
import { parseAmount, toCents } from '../../domain/money';
import { validateRecurring, type RecurringErrorCode, type RecurringInput, type RecurringTxn } from '../../domain/recurring';
import { useLedgerStore } from '../../state/ledgerStore';
import { useRecurringStore } from '../../state/recurringStore';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 編輯對象(null = 新增) */
  initial: RecurringTxn | null;
}

const ERR_KEYS: Record<RecurringErrorCode, string> = {
  amount: 'recurring.errAmount',
  category: 'recurring.errCategory',
  account: 'recurring.errAccount',
  day: 'recurring.errDay',
};

export function RecurringSheet({ visible, onClose, initial }: Props) {
  const { t } = useTranslation();
  const accounts = useLedgerStore((s) => s.accounts);
  const addRecurring = useRecurringStore((s) => s.addRecurring);
  const updateRecurring = useRecurringStore((s) => s.updateRecurring);
  const deleteRecurring = useRecurringStore((s) => s.deleteRecurring);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [dayText, setDayText] = useState('1');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<RecurringErrorCode | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    if (initial) {
      setType(initial.type);
      setAmountText(String(initial.amountCents / 100));
      setCategory(initial.category);
      setAccountId(initial.accountId);
      setDayText(String(initial.dayOfMonth));
      setNote(initial.note);
    } else {
      setType('expense');
      setAmountText('');
      setCategory(null);
      setAccountId(accounts[0]?.id ?? null);
      setDayText('1');
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial]);

  function changeType(next: 'expense' | 'income') {
    setType(next);
    setCategory(null);
  }

  async function save() {
    const amount = parseAmount(amountText);
    const input: RecurringInput = {
      type,
      amountCents: amount != null ? toCents(amount) : 0,
      category: category as RecurringInput['category'],
      accountId: accountId ?? '',
      dayOfMonth: Number(dayText.trim()) || 0,
      note,
    };
    const code = validateRecurring(input, accounts);
    if (code) {
      setErr(code);
      return;
    }
    const ok = initial ? await updateRecurring(initial.id, input) : await addRecurring(input);
    if (ok) onClose();
    else setErr('amount');
  }

  async function remove() {
    if (!initial) return;
    await deleteRecurring(initial.id);
    onClose();
  }

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{initial ? t('recurring.edit') : t('recurring.add')}</Text>

        <View style={styles.typeRow}>
          {(['expense', 'income'] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: type === v }}
              onPress={() => changeType(v)}
              style={[styles.typeSeg, type === v && styles.typeSegActive]}
            >
              <Text style={[styles.typeLabel, type === v && styles.typeLabelActive]}>
                {t(v === 'expense' ? 'txn.typeExpense' : 'txn.typeIncome')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.rowCell}>
            <Text style={styles.fieldLabel}>{t('txn.amount')}</Text>
            <TextInput
              accessibilityLabel={t('txn.amount')}
              style={styles.input}
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0"
              placeholderTextColor={color.inkMuted}
            />
          </View>
          <View style={styles.rowCell}>
            <Text style={styles.fieldLabel}>{t('recurring.day')}</Text>
            <TextInput
              accessibilityLabel={t('recurring.day')}
              style={styles.input}
              keyboardType="number-pad"
              value={dayText}
              onChangeText={setDayText}
              placeholder="1"
              placeholderTextColor={color.inkMuted}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('txn.category')}</Text>
          <View style={styles.chips}>
            {categories.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, category === c && styles.chipLabelActive]}>{t(categoryLabelKey(c))}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('txn.account')}</Text>
          <View style={styles.chips}>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() => setAccountId(a.id)}
                style={[styles.chip, accountId === a.id && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, accountId === a.id && styles.chipLabelActive]}>{a.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('txn.note')}</Text>
          <TextInput
            accessibilityLabel={t('txn.note')}
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder={t('txn.notePlaceholder')}
            placeholderTextColor={color.inkMuted}
          />
        </View>

        {err ? <Text style={styles.err}>{t(ERR_KEYS[err])}</Text> : null}

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

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
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
  },
  typeLabelActive: {
    color: color.accentDeep,
    fontFamily: font.family.bold,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowCell: {
    flex: 1,
    gap: 6,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontFamily: font.family.semibold,
  },
  input: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.h2,
    fontFamily: font.family.semibold,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
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
  chipLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
  },
  chipLabelActive: {
    color: color.accentDeep,
    fontFamily: font.family.semibold,
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
    fontFamily: font.family.semibold,
  },
  btnPrimary: {
    backgroundColor: color.accent,
  },
  btnPrimaryText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
