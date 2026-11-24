/**
 * CSV 匯入 Sheet(P4):選檔(UTF-8)→ 欄位自動偵測(可逐欄調整/停用)→ 選目標帳戶
 * → 前 5 筆預覽 → 逐筆 addTxn(驗證單一來源)→ 結果統計。
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { pickCsvFile } from '../../data/csv-io';
import { parseCsv, rowsToTxns, sniffSchema, type CsvSchema } from '../../domain/csv';
import { formatCents } from '../../domain/money';
import { useLedgerStore } from '../../state/ledgerStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ImportSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const { height } = useWindowDimensions();
  const accounts = useLedgerStore((s) => s.accounts);
  const addTxn = useLedgerStore((s) => s.addTxn);

  const [rows, setRows] = useState<string[][] | null>(null);
  const [schema, setSchema] = useState<CsvSchema | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  useEffect(() => {
    if (visible) {
      setRows(null);
      setSchema(null);
      setAccountId(accounts[0]?.id ?? null);
      setError(null);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const preview = useMemo(() => {
    if (!rows || !schema || !accountId) return null;
    return rowsToTxns(rows, schema, {
      accountId,
      expenseCategory: 'other',
      incomeCategory: 'otherIncome',
      accounts,
    });
  }, [rows, schema, accountId, accounts]);

  async function pick() {
    setError(null);
    const text = await pickCsvFile();
    if (text == null) return;
    const parsed = parseCsv(text);
    const sniffed = parsed.length >= 2 ? sniffSchema(parsed) : null;
    if (!sniffed) {
      setRows(null);
      setSchema(null);
      setError(t('import.errParse'));
      return;
    }
    setRows(parsed);
    setSchema(sniffed);
    setResult(null);
  }

  async function runImport() {
    if (!rows || !schema || !preview) return;
    if (!accountId) {
      setError(t('import.errAccount'));
      return;
    }
    if (preview.txns.length === 0) {
      setError(t('import.emptyFile'));
      return;
    }
    setImporting(true);
    let imported = 0;
    for (const input of preview.txns) {
      const ok = await addTxn(input);
      if (ok) imported++;
    }
    setImporting(false);
    setResult({ imported, skipped: preview.skipped + (preview.txns.length - imported) });
  }

  const width = rows ? Math.max(...rows.map((r) => r.length)) : 0;

  const headerLabel = (col: number): string => {
    if (!rows) return '';
    if (schema?.header && rows[0]?.[col]?.trim()) return `${col + 1}: ${rows[0]![col]!.trim().slice(0, 8)}`;
    return `${col + 1}`;
  };

  function ColumnPicker({
    label,
    value,
    optional,
    onChange,
  }: {
    label: string;
    value: number | null;
    optional: boolean;
    onChange: (v: number | null) => void;
  }) {
    return (
      <View style={styles.pickerField}>
        <Text style={styles.pickerLabel}>{label}</Text>
        <View style={styles.chips}>
          {optional ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(null)}
              style={[styles.chip, value == null && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, value == null && styles.chipLabelActive]}>{t('import.colNone')}</Text>
            </Pressable>
          ) : null}
          {Array.from({ length: width }, (_, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              onPress={() => onChange(i)}
              style={[styles.chip, value === i && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, value === i && styles.chipLabelActive]}>{headerLabel(i)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const setSchemaField = (patch: Partial<CsvSchema>) => setSchema((s) => (s ? { ...s, ...patch } : s));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.8 }} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('import.title')}</Text>
        <Text style={styles.hint}>{t('import.hint')}</Text>

        <Pressable accessibilityRole="button" style={styles.pickBtn} onPress={() => void pick()}>
          <Text style={styles.pickBtnText}>{t('import.pickFile')}</Text>
        </Pressable>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        {rows && schema ? (
          <>
            <Text style={styles.section}>{t('import.detected')}</Text>
            <ColumnPicker
              label={t('import.colDate')}
              value={schema.dateCol}
              optional={false}
              onChange={(v) => v != null && setSchemaField({ dateCol: v })}
            />
            <ColumnPicker
              label={t('import.colAmount')}
              value={schema.amountCol}
              optional
              onChange={(v) => setSchemaField({ amountCol: v, debitCol: null, creditCol: null })}
            />
            <ColumnPicker
              label={t('import.colDebit')}
              value={schema.debitCol}
              optional
              onChange={(v) => setSchemaField({ debitCol: v, amountCol: null })}
            />
            <ColumnPicker
              label={t('import.colCredit')}
              value={schema.creditCol}
              optional
              onChange={(v) => setSchemaField({ creditCol: v, amountCol: null })}
            />
            <ColumnPicker
              label={t('import.colDesc')}
              value={schema.descCol}
              optional
              onChange={(v) => setSchemaField({ descCol: v })}
            />

            <Text style={styles.section}>{t('import.targetAccount')}</Text>
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

            {preview ? (
              <>
                <Text style={styles.section}>{t('import.preview')}</Text>
                <View style={styles.previewCard}>
                  {preview.txns.slice(0, 5).map((x, i) => (
                    <Text key={i} style={styles.previewRow}>
                      {x.date} · {t(x.type === 'expense' ? 'txn.typeExpense' : 'txn.typeIncome')} ·{' '}
                      {formatCents(x.amountCents, lang)} · {x.note || '—'}
                    </Text>
                  ))}
                  {preview.txns.length === 0 ? <Text style={styles.previewRow}>{t('import.emptyFile')}</Text> : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  style={[styles.importBtn, importing && { opacity: 0.6 }]}
                  disabled={importing}
                  onPress={() => void runImport()}
                >
                  <Text style={styles.importBtnText}>
                    {importing ? t('import.importing') : t('import.importAction')}
                  </Text>
                </Pressable>
              </>
            ) : null}

            {result ? (
              <Text style={styles.resultOk}>
                {t('import.result', { imported: result.imported, skipped: result.skipped })}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </BottomSheet>
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
  hint: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
    marginTop: -8,
  },
  pickBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderColor: color.accent,
  },
  pickBtnText: {
    color: color.accentDeep,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  err: {
    fontSize: font.size.small,
    color: color.danger,
  },
  section: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
    marginTop: 4,
  },
  pickerField: {
    gap: 6,
  },
  pickerLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontFamily: font.family.semibold,
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
  previewCard: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 12,
    gap: 6,
  },
  previewRow: {
    fontSize: font.size.tiny,
    color: color.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  importBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.button,
    backgroundColor: color.accent,
    marginTop: 4,
  },
  importBtnText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  resultOk: {
    fontSize: font.size.small,
    color: color.income,
    fontFamily: font.family.semibold,
  },
});
