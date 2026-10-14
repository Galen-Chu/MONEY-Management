/**
 * 設定分頁:語言切換 + 資料安全聲明(本機儲存、零雲端)+ 關於。
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '../../components/ui/card';
import { Segmented } from '../../components/ui/segmented';
import type { Language } from '../../i18n';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font } from '../../theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const setLanguage = useSettings((s) => s.setLanguage);
  const lang = currentLanguage(settings);

  return (
    <View style={styles.content}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <Card style={styles.card}>
        <Text style={styles.rowTitle}>{t('settings.language')}</Text>
        <Segmented<Language>
          accessibilityLabel={t('settings.language')}
          value={lang}
          options={[
            { value: 'zh-TW', label: t('settings.langZh') },
            { value: 'en-US', label: t('settings.langEn') },
          ]}
          onChange={setLanguage}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.rowTitle}>{t('settings.privacyTitle')}</Text>
        <Text style={styles.privacyBody}>{t('settings.privacyBody')}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.rowTitle}>{t('settings.about')}</Text>
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>{t('settings.version')}</Text>
          <Text style={styles.versionValue}>1.0.0</Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 10,
  },
  title: {
    fontSize: font.size.title,
    fontWeight: '700',
    color: color.ink,
    marginBottom: 4,
  },
  card: {
    gap: 10,
  },
  rowTitle: {
    fontSize: font.size.h2,
    fontWeight: '700',
    color: color.ink,
  },
  privacyBody: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    lineHeight: 20,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionLabel: {
    fontSize: font.size.small,
    color: color.inkMuted,
  },
  versionValue: {
    fontSize: font.size.small,
    color: color.ink,
    fontWeight: '600',
  },
});
