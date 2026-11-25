/**
 * 交易列:分類色點 + 備註( fallback 分類名)/副行(分類 · 帳戶)+ 金額
 * (支出 − 紅、收入 + 綠、轉帳 ⇄ 中性)。Pressable → 編輯。
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CATEGORY_COLORS, categoryLabelKey } from '../../domain/categories';
import type { Txn } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { useSettings, currentLanguage } from '../../state/settings';
import { font, radius, useStyles, type ThemeColors } from '../../theme';

interface Props {
  txn: Txn;
  accountName: (id: string) => string;
  onPress: (txn: Txn) => void;
}

export function TxnRow({ txn, accountName, onPress }: Props) {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);

  const isExpense = txn.type === 'expense';
  const isIncome = txn.type === 'income';
  const amountText = `${isExpense ? '−' : isIncome ? '+' : ''}${formatCents(txn.amountCents, lang)}`;
  const amountStyle = isExpense ? styles.expense : isIncome ? styles.income : styles.neutral;

  const dotColor = txn.category ? CATEGORY_COLORS[txn.category] : c.inkMuted;
  const title = txn.note.trim() || (txn.category ? t(categoryLabelKey(txn.category)) : '');

  const secondary = txn.category ? t(categoryLabelKey(txn.category)) : '';
  const from = accountName(txn.accountId);
  const to = txn.toAccountId ? accountName(txn.toAccountId) : '';
  const accountPart = txn.type === 'transfer' ? `${from} → ${to}` : from;
  const secondaryFull = secondary ? `${secondary} · ${accountPart}` : accountPart;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(txn)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]}>
        {txn.type === 'transfer' ? <Text style={styles.dotArrow}>⇄</Text> : null}
      </View>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {secondaryFull}
        </Text>
      </View>
      <Text style={[styles.amount, amountStyle]}>{amountText}</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.row,
  },
  pressed: {
    backgroundColor: c.track,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotArrow: {
    color: c.onBrand,
    fontSize: 15,
    fontFamily: font.family.bold,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: font.size.body,
    color: c.ink,
    fontFamily: font.family.semibold,
  },
  secondary: {
    fontSize: font.size.tiny,
    color: c.inkMuted,
  },
  amount: {
    fontSize: font.size.body,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  expense: {
    color: c.expense,
  },
  income: {
    color: c.income,
  },
  neutral: {
    color: c.inkSecondary,
  },
});
