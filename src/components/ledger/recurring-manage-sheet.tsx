/**
 * 定期交易管理 Sheet:列表(note/類型 · 金額 · 每月N日;點擊編輯)+ 新增鈕。
 * 表單(RecurringSheet)疊於其上開啟。
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { categoryLabelKey } from '../../domain/categories';
import { formatCents } from '../../domain/money';
import { useRecurringStore } from '../../state/recurringStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';
import { Icon } from '../ui/icon';
import { RecurringSheet } from './recurring-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function RecurringManageSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const { height } = useWindowDimensions();
  const items = useRecurringStore((s) => s.items);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Parameters<typeof RecurringSheet>[0]['initial']>(null);

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <ScrollView style={{ maxHeight: height * 0.7 }} contentContainerStyle={styles.wrap}>
          <Text style={styles.title}>{t('recurring.title')}</Text>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('recurring.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('recurring.emptyBody')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setEditing(r);
                    setFormVisible(true);
                  }}
                  style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
                >
                  <View style={styles.itemMain}>
                    <Text style={styles.itemNote}>{r.note.trim() || t(categoryLabelKey(r.category))}</Text>
                    <Text style={styles.itemSub}>
                      {t(r.type === 'expense' ? 'txn.typeExpense' : 'txn.typeIncome')} · {t('recurring.everyMonth')}{' '}
                      {r.dayOfMonth} {t('recurring.dayUnit')}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.itemAmount,
                      r.type === 'expense' && { color: color.expense },
                    ]}
                  >
                    {r.type === 'expense' ? '−' : '+'}
                    {formatCents(r.amountCents, lang)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            style={styles.addBtn}
            onPress={() => {
              setEditing(null);
              setFormVisible(true);
            }}
          >
            <Icon name="plus" size={14} fill={color.onBrand} />
            <Text style={styles.addBtnText}>{t('recurring.add')}</Text>
          </Pressable>
        </ScrollView>
      </BottomSheet>

      <RecurringSheet visible={formVisible} onClose={() => setFormVisible(false)} initial={editing} />
    </>
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
  empty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  emptyBody: {
    fontSize: font.size.small,
    color: color.inkMuted,
    textAlign: 'center',
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 14,
    gap: 12,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemNote: {
    fontSize: font.size.body,
    fontFamily: font.family.semibold,
    color: color.ink,
  },
  itemSub: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  itemAmount: {
    fontSize: font.size.body,
    fontFamily: font.family.bold,
    color: color.income,
    fontVariant: ['tabular-nums'],
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.button,
    backgroundColor: color.accent,
    marginTop: 4,
  },
  addBtnText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
