/**
 * 載具設定 Sheet(綁定/編輯):卡別(手機條碼/悠遊卡/一卡通——愛金卡規格不支援直查)
 * + 載具號碼 + 驗證碼 + appID。憑證僅存本機 carrier_settings,不入備份。
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CARD_TYPES, type CardType } from '../../data/carrier-source';
import { useCarrierStore } from '../../state/carrierStore';
import { font, radius, useStyles, type ThemeColors } from '../../theme';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CARD_LABEL_KEYS: Record<CardType, string> = {
  '3J0002': 'carrier.typePhone',
  '1K0001': 'carrier.typeEasy',
  '1H0001': 'carrier.typeIpass',
};

export function CarrierSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { c, styles } = useStyles(makeStyles);
  const settings = useCarrierStore((s) => s.settings);
  const saveSettings = useCarrierStore((s) => s.saveSettings);

  const [cardType, setCardType] = useState<CardType>('3J0002');
  const [cardNo, setCardNo] = useState('');
  const [cardEncrypt, setCardEncrypt] = useState('');
  const [appID, setAppID] = useState('');
  const [err, setErr] = useState<'cardNo' | 'cardEncrypt' | null>(null);

  // 開啟時重置(已綁定 → 預填)
  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setCardType(settings?.cardType ?? '3J0002');
    setCardNo(settings?.cardNo ?? '');
    setCardEncrypt(settings?.cardEncrypt ?? '');
    setAppID(settings?.appID ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    if (!cardNo.trim()) {
      setErr('cardNo');
      return;
    }
    if (!cardEncrypt.trim()) {
      setErr('cardEncrypt');
      return;
    }
    const ok = await saveSettings({ cardType, cardNo, cardEncrypt, appID });
    if (ok) onClose();
    else setErr('cardNo');
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('carrier.setup')}</Text>

        <View style={styles.typeRow}>
          {CARD_TYPES.map((ct) => {
            const active = cardType === ct;
            return (
              <Pressable
                key={ct}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setCardType(ct)}
                style={[styles.typeSeg, active && styles.typeSegActive]}
              >
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t(CARD_LABEL_KEYS[ct])}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('carrier.cardNo')}</Text>
          <TextInput
            accessibilityLabel={t('carrier.cardNo')}
            style={styles.input}
            value={cardNo}
            onChangeText={setCardNo}
            placeholder={t('carrier.cardNoHint')}
            placeholderTextColor={c.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('carrier.cardEncrypt')}</Text>
          <TextInput
            accessibilityLabel={t('carrier.cardEncrypt')}
            style={styles.input}
            value={cardEncrypt}
            onChangeText={setCardEncrypt}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('carrier.appID')}</Text>
          <TextInput
            accessibilityLabel={t('carrier.appID')}
            style={styles.input}
            value={appID}
            onChangeText={setAppID}
            placeholder={t('carrier.appIDHint')}
            placeholderTextColor={c.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {err ? <Text style={styles.err}>{t(err === 'cardNo' ? 'carrier.errCardNo' : 'carrier.errCardEncrypt')}</Text> : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" style={[styles.btn, styles.btnPrimary]} onPress={save}>
            <Text style={styles.btnPrimaryText}>{t('common.save')}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
  },
  title: {
    fontSize: font.size.title,
    fontFamily: font.family.bold,
    color: c.ink,
  },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: c.track,
    borderRadius: radius.chip,
    padding: 3,
    gap: 3,
  },
  typeSeg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.chip - 3,
  },
  typeSegActive: {
    backgroundColor: c.surface,
  },
  typeLabel: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.medium,
  },
  typeLabelActive: {
    color: c.accentDeep,
    fontFamily: font.family.bold,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.semibold,
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.size.body,
    color: c.ink,
  },
  err: {
    fontSize: font.size.small,
    color: c.danger,
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
  btnPrimary: {
    backgroundColor: c.accent,
  },
  btnPrimaryText: {
    color: c.onBrand,
    fontSize: font.size.body,
    fontFamily: font.family.bold,
  },
});
