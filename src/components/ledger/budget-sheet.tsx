/**
 * 分類月預算編輯 Sheet:支出分類列表+每月金額輸入(元;留空=移除預算)。
 * 驗證走 domain.validateBudget;逐分類 upsert/remove。
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EXPENSE_CATEGORIES, categoryLabelKey } from '../../domain/categories';
import { parseAmount, toCents } from '../../domain/money';
import { useBudgetStore } from '../../state/budgetStore';
import { font, radius, useStyles, type ThemeColors } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function BudgetSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const { height } = useWindowDimensions();
  const budgets = useBudgetStore((s) => s.budgets);
  const setBudget = useBudgetStore((s) => s.setBudget);
  const removeBudget = useBudgetStore((s) => s.removeBudget);

  const [texts, setTexts] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    const next: Record<string, string> = {};
    for (const cat of EXPENSE_CATEGORIES) {
      const b = budgets.find((x) => x.category === cat);
      next[cat] = b ? String(b.amountCents / 100) : '';
    }
    setTexts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    for (const cat of EXPENSE_CATEGORIES) {
      const text = (texts[cat] ?? '').trim();
      if (!text) {
        await removeBudget(cat);
        continue;
      }
      const yuan = parseAmount(text);
      if (yuan == null) {
        setErr(t('budgets.errAmount'));
        return;
      }
      await setBudget(cat, toCents(yuan));
    }
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.75 }} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('budgets.title')}</Text>
        <Text style={styles.hint}>{t('budgets.noneHint')}</Text>

        <View style={styles.list}>
          {EXPENSE_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: c.accent }]} />
              <Text style={styles.label}>{t(categoryLabelKey(cat))}</Text>
              <TextInput
                accessibilityLabel={t(categoryLabelKey(cat))}
                style={styles.input}
                keyboardType="decimal-pad"
                value={texts[cat] ?? ''}
                onChangeText={(v) => setTexts((s) => ({ ...s, [cat]: v }))}
                placeholder="0"
                placeholderTextColor={c.inkMuted}
              />
            </View>
          ))}
        </View>

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable accessibilityRole="button" style={styles.saveBtn} onPress={() => void save()}>
          <Text style={styles.saveBtnText}>{t('common.save')}</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: c.ink,
  },
  hint: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
    marginTop: -8,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    flex: 1,
    fontSize: font.size.small,
    color: c.ink,
    fontFamily: font.family.semibold,
  },
  input: {
    width: 120,
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: font.size.body,
    color: c.ink,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  err: {
    fontSize: font.size.small,
    color: c.danger,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.button,
    backgroundColor: c.accent,
    marginTop: 4,
  },
  saveBtnText: {
    color: c.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
