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
import { createRepositories } from '../../data/db';
import { useLedgerStore } from '../../state/ledgerStore';
import { color, font } from '../../theme';

const TABS: { name: string; key: string }[] = [
  { name: 'index', key: 'tabs.today' },
  { name: 'accounts', key: 'tabs.accounts' },
  { name: 'stats', key: 'tabs.stats' },
  { name: 'settings', key: 'tabs.settings' },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      try {
        const repos = await createRepositories();
        useLedgerStore.getState().attach(repos.accounts, repos.txns);
        await useLedgerStore.getState().bootstrap();
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
                  <View style={[styles.dot, active && styles.dotActive]} />
                  <Text style={[styles.label, active && styles.labelActive]}>{t(tab.key)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="accounts" />
        <Tabs.Screen name="stats" />
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
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: color.accent,
  },
  label: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
    fontWeight: '600',
  },
  labelActive: {
    color: color.ink,
  },
});
