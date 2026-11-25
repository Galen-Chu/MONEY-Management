/**
 * 帳戶表單 Sheet(新增/編輯):名稱 + 類型(現金/銀行/信用卡)+ 期初餘額(可負)。
 * 刪除前由 store 檢查引用(accountInUse)→ 顯示 errInUse。
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Account, AccountType } from '../../domain/ledger';
import { toCents } from '../../domain/money';
import { useLedgerStore } from '../../state/ledgerStore';
import { font, radius, useStyles, type ThemeColors } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 編輯對象(null = 新增) */
  initial: Account | null;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; labelKey: string }> = [
  { value: 'cash', labelKey: 'accounts.typeCash' },
  { value: 'bank', labelKey: 'accounts.typeBank' },
  { value: 'credit', labelKey: 'accounts.typeCredit' },
];

type ErrCode = 'name' | 'amount' | 'inUse';

export function AccountSheet({ visible, onClose, initial }: Props) {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const addAccount = useLedgerStore((s) => s.addAccount);
  const updateAccount = useLedgerStore((s) => s.updateAccount);
  const deleteAccount = useLedgerStore((s) => s.deleteAccount);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [initialText, setInitialText] = useState('');
  const [err, setErr] = useState<ErrCode | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setInitialText(initial.initialCents % 100 === 0 ? String(initial.initialCents / 100) : (initial.initialCents / 100).toFixed(2));
    } else {
      setName('');
      setType('cash');
      setInitialText('');
    }
  }, [visible, initial]);

  async function save() {
    if (!name.trim()) {
      setErr('name');
      return;
    }
    // 期初餘額:空=0;可為負(信用卡欠款)
    let cents = 0;
    if (initialText.trim()) {
      const n = Number(initialText.trim());
      if (!Number.isFinite(n)) {
        setErr('amount');
        return;
      }
      cents = toCents(n);
    }
    const input = { name, type, initialCents: cents };
    const ok = initial ? await updateAccount(initial.id, input) : await addAccount(input);
    if (ok) onClose();
    else setErr('name');
  }

  async function remove() {
    if (!initial) return;
    const ok = await deleteAccount(initial.id);
    if (ok) onClose();
    else setErr('inUse');
  }

  const errText = err
    ? t(err === 'inUse' ? 'accounts.errInUse' : err === 'amount' ? 'accounts.errAmount' : 'accounts.errName')
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>
          {initial ? t('accounts.edit') : t('accounts.add')}
        </Text>

        <TextInput
          accessibilityLabel={t('accounts.name')}
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('accounts.namePlaceholder')}
          placeholderTextColor={c.inkMuted}
        />

        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((o) => {
            const active = o.value === type;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setType(o.value)}
                style={[styles.typeSeg, active && styles.typeSegActive]}
              >
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t(o.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.initialRow}>
          <Text style={styles.fieldLabel}>{t('accounts.initial')}</Text>
          <TextInput
            accessibilityLabel={t('accounts.initial')}
            style={styles.initialInput}
            keyboardType="numbers-and-punctuation"
            value={initialText}
            onChangeText={setInitialText}
            placeholder="0"
            placeholderTextColor={c.inkMuted}
          />
          <Text style={styles.hint}>{t('accounts.initialHint')}</Text>
        </View>

        {errText ? <Text style={styles.err}>{errText}</Text> : null}

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

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 14,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: c.ink,
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.body,
    color: c.ink,
  },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: c.track,
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
    backgroundColor: c.surface,
  },
  typeLabel: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.medium,
  },
  typeLabelActive: {
    color: c.accentDeep,
    fontFamily: font.family.bold,
  },
  initialRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.semibold,
  },
  initialInput: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.h2,
    fontFamily: font.family.semibold,
    color: c.ink,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
  },
  err: {
    fontSize: font.size.small,
    color: c.danger,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  btnSecondaryText: {
    color: c.danger,
    fontSize: font.size.body,
    fontFamily: font.family.semibold,
  },
  btnPrimary: {
    backgroundColor: c.accent,
  },
  btnPrimaryText: {
    color: c.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
