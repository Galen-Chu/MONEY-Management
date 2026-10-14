/** 白底圓角卡(surface、radius.card) */
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius } from '../../theme';

interface Props {
  style?: StyleProp<ViewStyle>;
}

export function Card({ style, children }: PropsWithChildren<Props>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: 16,
  },
});
