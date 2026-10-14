/** 空狀態:大 emoji + 標題 + 內文(置中、inkMuted) */
import { StyleSheet, Text, View } from 'react-native';

import { color, font } from '../../theme';

interface Props {
  emoji: string;
  title: string;
  body: string;
}

export function EmptyState({ emoji, title, body }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 6,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  title: {
    fontSize: font.size.h2,
    fontWeight: '600',
    color: color.ink,
  },
  body: {
    fontSize: font.size.small,
    color: color.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
