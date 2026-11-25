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
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function BudgetSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
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
    for (const c of EXPENSE_CATEGORIES) {
      const b = budgets.find((x) => x.category === c);
      next[c] = b ? String(b.amountCents / 100) : '';
    }
    setTexts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    for (const c of EXPENSE_CATEGORIES) {
      const text = (texts[c] ?? '').trim();
      if (!text) {
        await removeBudget(c);
        continue;
      }
      const yuan = parseAmount(text);
      if (yuan == null) {
        setErr(t('budgets.errAmount'));
        return;
      }
      await setBudget(c, toCents(yuan));
    }
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.75 }} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('budgets.title')}</Text>
        <Text style={styles.hint}>{t('budgets.noneHint')}</Text>

        <View style={styles.list}>
          {EXPENSE_CATEGORIES.map((c) => (
            <View key={c} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: color.accent }]} />
              <Text style={styles.label}>{t(categoryLabelKey(c))}</Text>
              <TextInput
                accessibilityLabel={t(categoryLabelKey(c))}
                style={styles.input}
                keyboardType="decimal-pad"
                value={texts[c] ?? ''}
                onChangeText={(v) => setTexts((s) => ({ ...s, [c]: v }))}
                placeholder="0"
                placeholderTextColor={color.inkMuted}
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
    color: color.ink,
    fontFamily: font.family.semibold,
  },
  input: {
    width: 120,
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: font.size.body,
    color: color.ink,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  err: {
    fontSize: font.size.small,
    color: color.danger,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.button,
    backgroundColor: color.accent,
    marginTop: 4,
  },
  saveBtnText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
