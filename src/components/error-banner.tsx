/**
 * 頂部錯誤橫幅:danger 底白字 + 關閉鈕;綁 ledgerStore.error。
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { color, font } from '../theme';
import { useLedgerStore } from '../state/ledgerStore';

export function ErrorBanner() {
  const { t } = useTranslation();
  const error = useLedgerStore((s) => s.error);
  const clearError = useLedgerStore((s) => s.clearError);
  if (!error) return null;

  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{t('common.errorTitle')}</Text>
        <Text style={styles.body}>{t('common.retryLater')}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={clearError}
        hitSlop={8}
      >
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: font.size.body,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: font.size.small,
  },
  close: {
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 4,
  },
});
