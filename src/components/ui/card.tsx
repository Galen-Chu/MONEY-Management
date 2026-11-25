/** 圓角卡(surface、radius.card) */
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, useStyles, type ThemeColors } from '../../theme';

interface Props {
  style?: StyleProp<ViewStyle>;
}

export function Card({ style, children }: PropsWithChildren<Props>) {
  const { styles } = useStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.card,
    padding: 16,
  },
});
