/**
 * 資產分頁(P3):品牌綠總覽卡(總估值+持有項目)+ 資產卡(名稱/類型/目前估值/較上次變動)
 * + 點卡看詳情(估值歷史+新增估值)+ 新增鈕。
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AssetDetailSheet } from '../../components/ledger/asset-detail';
import { AssetSheet } from '../../components/ledger/asset-sheet';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { assetValueAt, valueHistory, type Asset } from '../../domain/asset';
import { todayKey } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { useAssetStore } from '../../state/assetStore';
import { currentLanguage, useSettings } from '../../state/settings';
import { color, font, radius } from '../../theme';

const TYPE_KEYS: Record<Asset['type'], string> = {
  'real-estate': 'assets.typeRealEstate',
  vehicle: 'assets.typeVehicle',
  investment: 'assets.typeInvestment',
  insurance: 'assets.typeInsurance',
  other: 'assets.typeOther',
};

export default function AssetsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const assets = useAssetStore((s) => s.assets);
  const valuations = useAssetStore((s) => s.valuations);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [detail, setDetail] = useState<Asset | null>(null);

  const asOf = todayKey();
  const total = useMemo(() => assets.reduce((s, a) => s + assetValueAt(a.id, valuations, asOf), 0), [assets, valuations, asOf]);

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('assets.title')}</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.sumLabel}>{t('assets.totalValue')}</Text>
          <Text style={styles.sumValue}>{formatCents(total, lang)}</Text>
          <View style={styles.sumRow}>
            <Text style={styles.sumCellLabel}>{t('assets.holdings')}</Text>
            <Text style={styles.sumCellValue}>{assets.length}</Text>
          </View>
        </View>

        {assets.length === 0 ? (
          <EmptyState emoji="⛰️" title={t('assets.emptyTitle')} body={t('assets.emptyBody')} />
        ) : (
          assets.map((asset) => {
            const history = valueHistory(asset.id, valuations);
            const current = history.length ? history[history.length - 1]!.valueCents : 0;
            const prev = history.length > 1 ? history[history.length - 2]!.valueCents : null;
            const diff = prev != null && prev > 0 ? current - prev : null;
            const pct = diff != null ? Math.round((diff / prev!) * 100) : null;
            return (
              <Pressable
                key={asset.id}
                accessibilityRole="button"
                onPress={() => setDetail(asset)}
                style={({ pressed }) => [styles.assetCard, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.assetMain}>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetSub}>{t(TYPE_KEYS[asset.type])}</Text>
                </View>
                <View style={styles.assetRight}>
                  <Text style={styles.assetValue}>{formatCents(current, lang)}</Text>
                  {pct != null && pct !== 0 ? (
                    <Text style={[styles.assetPct, (pct ?? 0) > 0 ? styles.pctUp : styles.pctDown]}>
                      {pct! > 0 ? '+' : ''}{pct}%
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('assets.add')}
        onPress={() => {
          setEditing(null);
          setFormVisible(true);
        }}
        style={[styles.addBtn, { bottom: insets.bottom + 96 }]}
      >
        <Icon name="plus" size={14} fill={color.onBrand} />
        <Text style={styles.addText}>{t('assets.add')}</Text>
      </Pressable>

      <AssetDetailSheet
        visible={detail != null}
        onClose={() => setDetail(null)}
        asset={detail}
        onEdit={(asset) => {
          setDetail(null);
          setEditing(asset);
          setFormVisible(true);
        }}
      />
      <AssetSheet visible={formVisible} onClose={() => setFormVisible(false)} initial={editing} />
    </View>
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
    paddingBottom: 140,
    gap: 10,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  summaryCard: {
    backgroundColor: color.accent,
    borderRadius: radius.card,
    padding: 18,
    gap: 10,
  },
  sumLabel: {
    fontSize: font.size.small,
    color: color.onBrandSecondary,
    fontFamily: font.family.semibold,
  },
  sumValue: {
    fontSize: 30,
    color: color.onBrand,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  sumRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'baseline',
  },
  sumCellLabel: {
    fontSize: font.size.tiny,
    color: color.onBrandSecondary,
  },
  sumCellValue: {
    fontSize: font.size.body,
    color: color.onBrand,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.row,
    padding: 14,
    gap: 12,
  },
  assetMain: {
    flex: 1,
    gap: 2,
  },
  assetName: {
    fontSize: font.size.h2,
    fontFamily: font.family.semibold,
    color: color.ink,
  },
  assetSub: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
  },
  assetRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  assetValue: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  assetPct: {
    fontSize: font.size.tiny,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  pctUp: {
    color: color.income,
  },
  pctDown: {
    color: color.expense,
  },
  addBtn: {
    position: 'absolute',
    right: 20,
    backgroundColor: color.accent,
    borderRadius: radius.button,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 6,
    shadowColor: color.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  addText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
