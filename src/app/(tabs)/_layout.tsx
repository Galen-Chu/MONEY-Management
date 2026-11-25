/**
 * 四分頁導覽:記一筆(今天)/ 帳戶 / 統計 / 設定。
 * Repository 於此初始化(所有分頁共用;bootstrap 失敗寫入 error 由橫幅呈現)。
 */
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ErrorBanner } from '../../components/error-banner';
import { Icon, type IconName } from '../../components/ui/icon';
import { createRepositories } from '../../data/db';
import { useAssetStore } from '../../state/assetStore';
import { useBudgetStore } from '../../state/budgetStore';
import { useInvoiceStore } from '../../state/invoiceStore';
import { useLedgerStore } from '../../state/ledgerStore';
import { useLoanStore } from '../../state/loanStore';
import { color, font } from '../../theme';

const TABS: { name: string; key: string; icon: IconName }[] = [
  { name: 'index', key: 'tabs.today', icon: 'sun' },
  { name: 'loans', key: 'tabs.loans', icon: 'ledger' },
  { name: 'accounts', key: 'tabs.accounts', icon: 'balance' },
  { name: 'stats', key: 'tabs.stats', icon: 'dashboard' },
  { name: 'invoice', key: 'tabs.invoice', icon: 'envelope' },
  { name: 'assets', key: 'tabs.assets', icon: 'mountain' },
  { name: 'settings', key: 'tabs.settings', icon: 'typewriter' },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      try {
        const repos = await createRepositories();
        useLedgerStore.getState().attach(repos.accounts, repos.txns);
        useLoanStore.getState().attach(repos.loans);
        useInvoiceStore.getState().attach(repos.invoices, repos.prizes);
        useAssetStore.getState().attach(repos.assets, repos.valuations);
        useBudgetStore.getState().attach(repos.budgets);
        await Promise.all([
          useLedgerStore.getState().bootstrap(),
          useLoanStore.getState().bootstrap(),
          useInvoiceStore.getState().bootstrap(),
          useAssetStore.getState().bootstrap(),
          useBudgetStore.getState().bootstrap(),
        ]);
      } catch (e) {
        useLedgerStore.setState({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, []);

  return (
    <View style={styles.shell}>
      <ErrorBanner />
      <Tabs
        tabBar={(props) => (
          <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
            {TABS.map((tab, i) => {
              const active = props.state.index === i;
              return (
                <Pressable
                  key={tab.name}
                  onPress={() => {
                    const event = props.navigation.emit({
                      type: 'tabPress',
                      target: props.state.routes[i]!.key,
                      canPreventDefault: true,
                    });
                    if (!event.defaultPrevented) {
                      props.navigation.navigate(tab.name);
                    }
                  }}
                  style={styles.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Icon name={tab.icon} size={22} fill={active ? color.accent : color.inkMuted} />
                  <Text style={[styles.label, active && styles.labelActive]}>{t(tab.key)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="loans" />
        <Tabs.Screen name="accounts" />
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="invoice" />
        <Tabs.Screen name="assets" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: color.bg,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
    fontFamily: font.family.semibold,
  },
  labelActive: {
    color: color.ink,
  },
});
