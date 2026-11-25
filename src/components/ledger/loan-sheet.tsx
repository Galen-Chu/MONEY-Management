/**
 * 貸款表單 Sheet(新增/編輯):名稱、類型(房/車/信/學/他)、本金、年利率(%)、
 * 期數(月)、起算日、還款方式(本息/本金攤還)、寬限期。
 * 驗證走 domain.validateLoan(錯誤碼 → i18n `loan.err*`);本金/利率以十進位輸入後轉整數。
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  LOAN_METHODS,
  LOAN_TYPES,
  validateLoan,
  type Loan,
  type LoanErrorCode,
  type LoanInput,
  type LoanMethod,
  type LoanType,
} from '../../domain/loan';
import { toCents } from '../../domain/money';
import { todayKey } from '../../domain/ledger';
import { useLoanStore } from '../../state/loanStore';
import { font, radius, useStyles, type ThemeColors } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 編輯對象(null = 新增) */
  initial: Loan | null;
}

const TYPE_KEYS: Record<LoanType, string> = {
  mortgage: 'loans.typeMortgage',
  car: 'loans.typeCar',
  personal: 'loans.typePersonal',
  student: 'loans.typeStudent',
  other: 'loans.typeOther',
};

const METHOD_KEYS: Record<LoanMethod, string> = {
  annuity: 'loans.methodAnnuity',
  principal: 'loans.methodPrincipal',
};

function errKey(code: LoanErrorCode): string {
  return `loans.err${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

/** 年利率輸入(%)→ milliPercent 整數;非法(非有限/超出 0–30)回 null */
function parseRate(text: string): number | null {
  const n = Number(text.trim());
  if (!text.trim() || !Number.isFinite(n) || n < 0 || n > 30) return null;
  return Math.round(n * 1000);
}

function parseCount(text: string, fallback = 0): number | null {
  if (!text.trim()) return fallback;
  const n = Number(text.trim());
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function LoanSheet({ visible, onClose, initial }: Props) {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const addLoan = useLoanStore((s) => s.addLoan);
  const updateLoan = useLoanStore((s) => s.updateLoan);
  const deleteLoan = useLoanStore((s) => s.deleteLoan);

  const [name, setName] = useState('');
  const [type, setType] = useState<LoanType>('mortgage');
  const [principalText, setPrincipalText] = useState('');
  const [rateText, setRateText] = useState('');
  const [termText, setTermText] = useState('');
  const [startText, setStartText] = useState(todayKey());
  const [method, setMethod] = useState<LoanMethod>('annuity');
  const [graceText, setGraceText] = useState('');
  const [err, setErr] = useState<LoanErrorCode | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setPrincipalText(String(initial.principalCents / 100));
      setRateText(String(initial.annualRateMilliPercent / 1000));
      setTermText(String(initial.termMonths));
      setStartText(initial.startDate);
      setMethod(initial.method);
      setGraceText(initial.graceMonths ? String(initial.graceMonths) : '');
    } else {
      setName('');
      setType('mortgage');
      setPrincipalText('');
      setRateText('');
      setTermText('');
      setStartText(todayKey());
      setMethod('annuity');
      setGraceText('');
    }
  }, [visible, initial]);

  async function save() {
    const principalYuan = Number(principalText.trim());
    const principalCents = principalText.trim() && Number.isFinite(principalYuan) ? toCents(principalYuan) : 0;
    const input: LoanInput = {
      name,
      type,
      principalCents,
      annualRateMilliPercent: parseRate(rateText) ?? -1,
      termMonths: parseCount(termText, -1) ?? -1,
      startDate: startText.trim(),
      method,
      graceMonths: parseCount(graceText, 0) ?? -1,
    };
    const code = validateLoan(input);
    if (code) {
      setErr(code);
      return;
    }
    const ok = initial ? await updateLoan(initial.id, input) : await addLoan(input);
    if (ok) onClose();
    else setErr('name');
  }

  async function remove() {
    if (!initial) return;
    await deleteLoan(initial.id);
    onClose();
  }

  const errMessage = err ? t(errKey(err)) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{initial ? t('loans.edit') : t('loans.add')}</Text>

        <TextInput
          accessibilityLabel={t('loans.name')}
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('loans.namePlaceholder')}
          placeholderTextColor={c.inkMuted}
        />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('loans.type')}</Text>
          <View style={styles.chips}>
            {LOAN_TYPES.map((v) => (
              <Chip key={v} label={t(TYPE_KEYS[v])} active={type === v} onPress={() => setType(v)} />
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowCell}>
            <Text style={styles.fieldLabel}>{t('loans.principal')}</Text>
            <TextInput
              accessibilityLabel={t('loans.principal')}
              style={styles.input}
              keyboardType="decimal-pad"
              value={principalText}
              onChangeText={setPrincipalText}
              placeholder="0"
              placeholderTextColor={c.inkMuted}
            />
          </View>
          <View style={styles.rowCell}>
            <Text style={styles.fieldLabel}>{t('loans.rate')}</Text>
            <TextInput
              accessibilityLabel={t('loans.rate')}
              style={styles.input}
              keyboardType="decimal-pad"
              value={rateText}
              onChangeText={setRateText}
              placeholder="0"
              placeholderTextColor={c.inkMuted}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowCell}>
            <Text style={styles.fieldLabel}>{t('loans.term')}</Text>
            <TextInput
              accessibilityLabel={t('loans.term')}
              style={styles.input}
              keyboardType="number-pad"
              value={termText}
              onChangeText={setTermText}
              placeholder="360"
              placeholderTextColor={c.inkMuted}
            />
            <Text style={styles.hint}>{t('loans.termHint')}</Text>
          </View>
          <View style={styles.rowCell}>
            <Text style={styles.fieldLabel}>{t('loans.startDate')}</Text>
            <TextInput
              accessibilityLabel={t('loans.startDate')}
              style={styles.input}
              value={startText}
              onChangeText={setStartText}
              placeholder={t('loans.startDateHint')}
              placeholderTextColor={c.inkMuted}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('loans.method')}</Text>
          <View style={styles.typeRow}>
            {LOAN_METHODS.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: method === m }}
                onPress={() => setMethod(m)}
                style={[styles.typeSeg, method === m && styles.typeSegActive]}
              >
                <Text style={[styles.typeLabel, method === m && styles.typeLabelActive]}>{t(METHOD_KEYS[m])}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('loans.grace')}</Text>
          <TextInput
            accessibilityLabel={t('loans.grace')}
            style={styles.graceInput}
            keyboardType="number-pad"
            value={graceText}
            onChangeText={setGraceText}
            placeholder="0"
            placeholderTextColor={c.inkMuted}
          />
          <Text style={styles.hint}>{t('loans.graceHint')}</Text>
        </View>

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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { styles } = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
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
    fontSize: font.size.h2,
    fontFamily: font.family.semibold,
    color: c.ink,
    fontVariant: ['tabular-nums'],
  },
  graceInput: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.body,
    color: c.ink,
    fontVariant: ['tabular-nums'],
    alignSelf: 'flex-start',
    minWidth: 120,
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
    color: c.inkSecondary,
    fontFamily: font.family.semibold,
  },
  hint: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  chipActive: {
    borderColor: c.accent,
    backgroundColor: c.accentSoft,
  },
  chipLabel: {
    fontSize: font.size.small,
    color: c.inkSecondary,
  },
  chipLabelActive: {
    color: c.accentDeep,
    fontFamily: font.family.semibold,
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
