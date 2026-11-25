/**
 * 頂部錯誤橫幅:danger 底白字 + 關閉鈕;合併呈現各 store 的 error。
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { color, font } from '../theme';
import { useLedgerStore } from '../state/ledgerStore';
import { useLoanStore } from '../state/loanStore';
import { useInvoiceStore } from '../state/invoiceStore';
import { useAssetStore } from '../state/assetStore';
import { useBudgetStore } from '../state/budgetStore';
import { Icon } from './ui/icon';

export function ErrorBanner() {
  const { t } = useTranslation();
  const ledgerError = useLedgerStore((s) => s.error);
  const clearLedgerError = useLedgerStore((s) => s.clearError);
  const loanError = useLoanStore((s) => s.error);
  const clearLoanError = useLoanStore((s) => s.clearError);
  const invoiceError = useInvoiceStore((s) => s.error);
  const clearInvoiceError = useInvoiceStore((s) => s.clearError);
  const assetError = useAssetStore((s) => s.error);
  const clearAssetError = useAssetStore((s) => s.clearError);
  const budgetError = useBudgetStore((s) => s.error);
  const clearBudgetError = useBudgetStore((s) => s.clearError);
  const error = ledgerError ?? loanError ?? invoiceError ?? assetError ?? budgetError;
  if (!error) return null;

  const clearError = () => {
    clearLedgerError();
    clearLoanError();
    clearInvoiceError();
    clearAssetError();
    clearBudgetError();
  };

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
        <Icon name="close" size={16} fill={color.onBrand} />
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
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  body: {
    color: color.onBrandSecondary,
    fontSize: font.size.small,
  },
});
