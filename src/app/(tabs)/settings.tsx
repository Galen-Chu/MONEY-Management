/**
 * 設定分頁:語言切換 + 備份(匯出/還原)+ 資料安全聲明(本機儲存、零雲端)+ 關於。
 * 還原採兩段式確認(第一次點=備援、4 秒內再點=執行),避免誤觸取代全部資料。
 */
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '../../components/ui/card';
import { Segmented } from '../../components/ui/segmented';
import { restoreBackup, collectBackupData } from '../../data/backup';
import { pickBackupFile, shareBackupFile } from '../../data/backup-io';
import { ImportSheet } from '../../components/ledger/import-sheet';
import { parseBackup, serializeBackup } from '../../domain/backup';
import type { Language } from '../../i18n';
import { useAssetStore } from '../../state/assetStore';
import { useBudgetStore } from '../../state/budgetStore';
import { useLedgerStore } from '../../state/ledgerStore';
import { useLoanStore } from '../../state/loanStore';
import { useInvoiceStore } from '../../state/invoiceStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

interface Status {
  kind: 'ok' | 'err';
  text: string;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const setLanguage = useSettings((s) => s.setLanguage);
  const lang = currentLanguage(settings);

  const accounts = useLedgerStore((s) => s.accounts);
  const txns = useLedgerStore((s) => s.txns);
  const loans = useLoanStore((s) => s.loans);
  const assets = useAssetStore((s) => s.assets);
  const valuations = useAssetStore((s) => s.valuations);
  const budgets = useBudgetStore((s) => s.budgets);

  const [status, setStatus] = useState<Status | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [csvVisible, setCsvVisible] = useState(false);

  async function onExport() {
    try {
      const ok = await shareBackupFile(
        serializeBackup(collectBackupData(accounts, txns, loans, assets, valuations, budgets))
      );
      setStatus(ok ? { kind: 'ok', text: t('settings.exportDone') } : { kind: 'err', text: t('settings.errExport') });
    } catch {
      setStatus({ kind: 'err', text: t('settings.errExport') });
    }
  }

  function armImport() {
    if (!confirmImport) {
      setConfirmImport(true);
      setStatus(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmImport(false), 4000);
      return;
    }
    setConfirmImport(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    void doImport();
  }

  async function doImport() {
    try {
      const text = await pickBackupFile();
      if (text == null) return;
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        setStatus({
          kind: 'err',
          text: t(parsed.error === 'version' ? 'settings.errBackupVersion' : 'settings.errBackupFormat'),
        });
        return;
      }
      // 動態載入:避免測試環境載入平台 db 實作(expo-sqlite)
      const { createRepositories } = await import('../../data/db');
      const repos = await createRepositories();
      await restoreBackup(repos, parsed.data);
      await Promise.all([
        useLedgerStore.getState().bootstrap(),
        useLoanStore.getState().bootstrap(),
        useInvoiceStore.getState().bootstrap(),
        useAssetStore.getState().bootstrap(),
        useBudgetStore.getState().bootstrap(),
      ]);
      setStatus({
        kind: 'ok',
        text: t('settings.importDone', {
          accounts: parsed.data.accounts.length,
          txns: parsed.data.txns.length,
          loans: parsed.data.loans.length,
        }),
      });
    } catch {
      setStatus({ kind: 'err', text: t('settings.errImport') });
    }
  }

  return (
    <ScrollView style={styles.shell} contentContainerStyle={styles.content}>
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
        <Text style={styles.rowTitle}>{t('settings.backupTitle')}</Text>
        <Text style={styles.backupBody}>{t('settings.backupBody')}</Text>
        <View style={styles.backupRow}>
          <Pressable accessibilityRole="button" style={[styles.backupBtn, styles.backupBtnPrimary]} onPress={() => void onExport()}>
            <Text style={styles.backupBtnPrimaryText}>{t('settings.export')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={[styles.backupBtn, styles.backupBtnSecondary]} onPress={armImport}>
            <Text style={styles.backupBtnSecondaryText}>
              {confirmImport ? t('settings.importConfirm') : t('settings.import')}
            </Text>
          </Pressable>
        </View>
        {status ? (
          <Text style={[styles.status, status.kind === 'ok' ? styles.statusOk : styles.statusErr]}>{status.text}</Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.rowTitle}>{t('settings.csvImport')}</Text>
        <Pressable accessibilityRole="button" style={styles.csvBtn} onPress={() => setCsvVisible(true)}>
          <Text style={styles.csvBtnText}>{t('import.pickFile')}</Text>
        </Pressable>
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
      <ImportSheet visible={csvVisible} onClose={() => setCsvVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 10,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: color.ink,
    marginBottom: 4,
  },
  card: {
    gap: 10,
  },
  rowTitle: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  backupBody: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    lineHeight: 20,
  },
  backupRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backupBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.button,
  },
  backupBtnPrimary: {
    backgroundColor: color.accent,
  },
  backupBtnPrimaryText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  backupBtnSecondary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  backupBtnSecondaryText: {
    color: color.ink,
    fontSize: font.size.body,
    fontFamily: font.family.semibold,
  },
  status: {
    fontSize: font.size.small,
    fontFamily: font.family.semibold,
  },
  statusOk: {
    color: color.income,
  },
  statusErr: {
    color: color.danger,
  },
  csvBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderColor: color.accent,
  },
  csvBtnText: {
    color: color.accentDeep,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
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
    fontFamily: font.family.semibold,
  },
});
