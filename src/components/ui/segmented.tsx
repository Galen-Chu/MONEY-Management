/**
 * 藥丸分段控制:選項列(track 底)+作用段(surface 白底 + accent 文字)。
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { font, radius, useStyles, type ThemeColors } from '../../theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  accessibilityLabel?: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ accessibilityLabel, value, options, onChange }: Props<T>) {
  const { styles } = useStyles(makeStyles);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={styles.track}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: c.track,
    borderRadius: radius.chip,
    padding: 3,
    gap: 3,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.chip - 3,
  },
  segActive: {
    backgroundColor: c.surface,
  },
  label: {
    fontSize: font.size.small,
    color: c.inkSecondary,
    fontFamily: font.family.medium,
  },
  labelActive: {
    color: c.accentDeep,
    fontFamily: font.family.bold,
  },
});
