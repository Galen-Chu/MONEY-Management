/**
 * 發票表單 Sheet(新增/編輯):號碼(自動大寫)+ 備註;期別沿用分頁所選。
 * 驗證走 domain.validateInvoice(錯誤碼 → i18n `invoice.err*`)。
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { validateInvoice, type Invoice, type InvoiceTerm } from '../../domain/invoice';
import { useInvoiceStore } from '../../state/invoiceStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { monthLabel, termPeriodInfo } from '../../i18n/format';
import { font, radius, useStyles, type ThemeColors } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 編輯對象(null = 新增) */
  initial: Invoice | null;
  term: InvoiceTerm;
}

export function InvoiceSheet({ visible, onClose, initial, term }: Props) {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const addInvoice = useInvoiceStore((s) => s.addInvoice);
  const deleteInvoice = useInvoiceStore((s) => s.deleteInvoice);

  const [numberText, setNumberText] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<'number' | 'term' | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    if (initial) {
      setNumberText(initial.number);
      setNote(initial.note);
    } else {
      setNumberText('');
      setNote('');
    }
  }, [visible, initial]);

  async function save() {
    const number = numberText.trim().toUpperCase();
    const code = validateInvoice(number, term);
    if (code) {
      setErr(code);
      return;
    }
    const ok = await addInvoice(number, term, note);
    if (ok) onClose();
    else setErr('number');
  }

  async function remove() {
    if (!initial) return;
    await deleteInvoice(initial.id);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{initial ? t('invoice.edit') : t('invoice.add')}</Text>
        <Text style={styles.termHint}>
          {t('invoice.periodLabel', {
            year: lang === 'en-US' ? termPeriodInfo(term).gregYear : termPeriodInfo(term).rocYear,
            from: monthLabel(termPeriodInfo(term).fromMonth, lang),
            to: monthLabel(termPeriodInfo(term).toMonth, lang),
          })}
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('invoice.number')}</Text>
          <TextInput
            accessibilityLabel={t('invoice.number')}
            style={styles.input}
            value={numberText}
            onChangeText={(v) => setNumberText(v.toUpperCase())}
            placeholder={t('invoice.numberPlaceholder')}
            placeholderTextColor={c.inkMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={styles.hint}>{t('invoice.numberHint')}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('invoice.note')}</Text>
          <TextInput
            accessibilityLabel={t('invoice.note')}
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder={t('invoice.notePlaceholder')}
            placeholderTextColor={c.inkMuted}
          />
        </View>

        {err ? <Text style={styles.err}>{t(err === 'number' ? 'invoice.errNumber' : 'invoice.errTerm')}</Text> : null}

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
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: c.ink,
  },
  termHint: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    marginTop: -8,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.semibold,
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
