/**
 * 資產詳情 Sheet:目前估值 + 估值歷史(日期+金額,最新在上)+ 新增估值(值+日期,留空=今天)。
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { valueHistory, type Asset, type AssetValuation } from '../../domain/asset';
import { todayKey } from '../../domain/ledger';
import { formatCents } from '../../domain/money';
import { formatDayLabel } from '../../i18n/format';
import { currentLanguage, useSettings } from '../../state/settings';
import { useAssetStore } from '../../state/assetStore';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  asset: Asset | null;
  onEdit: (asset: Asset) => void;
}

const TYPE_KEYS: Record<Asset['type'], string> = {
  'real-estate': 'assets.typeRealEstate',
  vehicle: 'assets.typeVehicle',
  investment: 'assets.typeInvestment',
  insurance: 'assets.typeInsurance',
  other: 'assets.typeOther',
};

export function AssetDetailSheet({ visible, onClose, asset, onEdit }: Props) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const lang = currentLanguage(settings);
  const { height } = useWindowDimensions();
  const valuations = useAssetStore((s) => s.valuations);
  const addValuation = useAssetStore((s) => s.addValuation);

  const [valueText, setValueText] = useState('');
  const [dateText, setDateText] = useState(todayKey());
  const [err, setErr] = useState<'value' | 'date' | null>(null);

  useEffect(() => {
    if (visible) {
      setValueText('');
      setDateText(todayKey());
      setErr(null);
    }
  }, [visible]);

  const history = useMemo<AssetValuation[]>(
    () => (asset ? [...valueHistory(asset.id, valuations)].reverse() : []),
    [asset, valuations]
  );

  if (!asset) return null;
  const current = history[0]?.valueCents ?? 0;

  async function submitValuation() {
    const trimmed = valueText.trim();
    const n = Number(trimmed);
    if (!trimmed || !Number.isFinite(n) || n < 0) {
      setErr('value');
      return;
    }
    const date = dateText.trim() || todayKey();
    const ok = await addValuation(asset!.id, Math.round(n * 100), date);
    if (ok) {
      setValueText('');
      setDateText(todayKey());
      setErr(null);
    } else {
      setErr('date');
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.78 }} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{asset.name}</Text>
        <Text style={styles.subtitle}>{t(TYPE_KEYS[asset.type])}</Text>

        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>{t('assets.currentValue')}</Text>
          <Text style={styles.currentValue}>{formatCents(current, lang)}</Text>
        </View>

        <Text style={styles.section}>{t('assets.addValuation')}</Text>
        <View style={styles.valRow}>
          <TextInput
            accessibilityLabel={t('assets.valuation')}
            style={styles.valInput}
            keyboardType="decimal-pad"
            value={valueText}
            onChangeText={setValueText}
            placeholder="0"
            placeholderTextColor={color.inkMuted}
          />
          <TextInput
            accessibilityLabel={t('assets.valuationDate')}
            style={styles.dateInput}
            value={dateText}
            onChangeText={setDateText}
            placeholder={todayKey()}
            placeholderTextColor={color.inkMuted}
            autoCapitalize="none"
          />
          <Pressable accessibilityRole="button" style={styles.valBtn} onPress={() => void submitValuation()}>
            <Text style={styles.valBtnText}>{t('common.add')}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{t('assets.valuationHint')}</Text>
        {err ? <Text style={styles.err}>{t(err === 'value' ? 'assets.errValue' : 'assets.errDate')}</Text> : null}

        <Text style={styles.section}>{t('assets.history')}</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyHistory}>{t('assets.emptyHistory')}</Text>
        ) : (
          <View style={styles.historyCard}>
            {history.map((v) => (
              <View key={v.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{formatDayLabel(v.date, lang)}</Text>
                <Text style={styles.historyValue}>{formatCents(v.valueCents, lang)}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable accessibilityRole="button" style={styles.editBtn} onPress={() => onEdit(asset)}>
          <Text style={styles.editBtnText}>{t('assets.edit')}</Text>
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
  subtitle: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    marginTop: -8,
  },
  currentCard: {
    backgroundColor: color.accent,
    borderRadius: radius.row,
    padding: 16,
    gap: 4,
  },
  currentLabel: {
    fontSize: font.size.small,
    color: color.onBrandSecondary,
    fontFamily: font.family.semibold,
  },
  currentValue: {
    fontSize: 28,
    color: color.onBrand,
    fontFamily: font.family.bold,
    fontVariant: ['tabular-nums'],
  },
  section: {
    fontSize: font.size.h2,
    fontFamily: font.family.bold,
    color: color.ink,
    marginTop: 4,
  },
  valRow: {
    flexDirection: 'row',
    gap: 8,
  },
  valInput: {
    flex: 2,
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.body,
    fontFamily: font.family.semibold,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  dateInput: {
    flex: 2,
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.body,
    color: color.ink,
  },
  valBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accent,
    borderRadius: radius.button,
    paddingHorizontal: 16,
  },
  valBtnText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
  hint: {
    fontSize: font.size.tiny,
    color: color.inkMuted,
    marginTop: -8,
  },
  err: {
    fontSize: font.size.small,
    color: color.danger,
  },
  historyCard: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    padding: 14,
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDate: {
    fontSize: font.size.small,
    color: color.inkSecondary,
  },
  historyValue: {
    fontSize: font.size.small,
    color: color.ink,
    fontFamily: font.family.semibold,
    fontVariant: ['tabular-nums'],
  },
  emptyHistory: {
    fontSize: font.size.small,
    color: color.inkMuted,
  },
  editBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.button,
    backgroundColor: color.accent,
    marginTop: 4,
  },
  editBtnText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
