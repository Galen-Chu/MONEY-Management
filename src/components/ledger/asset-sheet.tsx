/**
 * 資產表單 Sheet(新增/編輯):名稱、類型 chips、初始估值(新增時,寫入首筆估值)。
 * 編輯模式僅改名稱/類型(估值走詳情 Sheet 的估值歷史)。
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ASSET_TYPES, validateAsset, type Asset, type AssetType } from '../../domain/asset';
import { parseAmount, toCents } from '../../domain/money';
import { useAssetStore } from '../../state/assetStore';
import { color, font, radius } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 編輯對象(null = 新增) */
  initial: Asset | null;
}

const TYPE_KEYS: Record<AssetType, string> = {
  'real-estate': 'assets.typeRealEstate',
  vehicle: 'assets.typeVehicle',
  investment: 'assets.typeInvestment',
  insurance: 'assets.typeInsurance',
  other: 'assets.typeOther',
};

function errKey(code: 'name' | 'type'): string {
  return `assets.err${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

export function AssetSheet({ visible, onClose, initial }: Props) {
  const { t } = useTranslation();
  const addAsset = useAssetStore((s) => s.addAsset);
  const updateAsset = useAssetStore((s) => s.updateAsset);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);

  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('real-estate');
  const [valueText, setValueText] = useState('');
  const [err, setErr] = useState<'name' | 'type' | null>(null);
  const [valueErr, setValueErr] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setValueErr(false);
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setValueText('');
    } else {
      setName('');
      setType('real-estate');
      setValueText('');
    }
  }, [visible, initial]);

  async function save() {
    const code = validateAsset(name, type);
    if (code) {
      setErr(code);
      return;
    }
    if (initial) {
      const ok = await updateAsset(initial.id, name, type);
      if (ok) onClose();
      else setErr('name');
      return;
    }
    const value = parseAmount(valueText); // 估值允許 0:空=0
    if (value == null && valueText.trim() !== '') {
      setValueErr(true);
      return;
    }
    const ok = await addAsset(name, type, value != null ? toCents(value) : 0);
    if (ok) onClose();
    else {
      setValueErr(true);
      setErr('name');
    }
  }

  async function remove() {
    if (!initial) return;
    await deleteAsset(initial.id);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{initial ? t('assets.edit') : t('assets.add')}</Text>

        <TextInput
          accessibilityLabel={t('assets.name')}
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('assets.namePlaceholder')}
          placeholderTextColor={color.inkMuted}
        />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('assets.type')}</Text>
          <View style={styles.chips}>
            {ASSET_TYPES.map((v) => (
              <Pressable
                key={v}
                accessibilityRole="button"
                onPress={() => setType(v)}
                style={[styles.chip, type === v && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, type === v && styles.chipLabelActive]}>{t(TYPE_KEYS[v])}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {!initial ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('assets.value')}</Text>
            <TextInput
              accessibilityLabel={t('assets.value')}
              style={styles.input}
              keyboardType="decimal-pad"
              value={valueText}
              onChangeText={setValueText}
              placeholder="0"
              placeholderTextColor={color.inkMuted}
            />
          </View>
        ) : null}

        {err ? <Text style={styles.err}>{t(errKey(err))}</Text> : null}
        {valueErr ? <Text style={styles.err}>{t('assets.errValue')}</Text> : null}

        <View style={styles.actions}>
          {initial ? (
            <Pressable accessibilityRole="button" style={[styles.btn, styles.btnSecondary]} onPress={remove}>
              <Text style={styles.btnSecondaryText}>{t('common.delete')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={[styles.btn, styles.btnPrimary, initial && { flex: 2 }]} onPress={save}>
            <Text style={styles.btnPrimaryText}>{t('common.save')}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: color.ink,
  },
  input: {
    backgroundColor: color.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.h2,
    fontFamily: font.family.semibold,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
    fontFamily: font.family.semibold,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.chip,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  chipActive: {
    borderColor: color.accent,
    backgroundColor: color.accentSoft,
  },
  chipLabel: {
    fontSize: font.size.small,
    color: color.inkSecondary,
  },
  chipLabelActive: {
    color: color.accentDeep,
    fontFamily: font.family.semibold,
  },
  err: {
    fontSize: font.size.small,
    color: color.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.button,
  },
  btnSecondary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  btnSecondaryText: {
    color: color.danger,
    fontSize: font.size.body,
    fontFamily: font.family.semibold,
  },
  btnPrimary: {
    backgroundColor: color.accent,
  },
  btnPrimaryText: {
    color: color.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
