// Pochette d'un morceau ou d'un album, avec un visuel de remplacement si absente.
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { Icon } from './Icon';

export function Cover({
  uri, size, rounded = radius.sm, style, highlight,
}: {
  uri: string | null | undefined;
  size: number | '100%';
  rounded?: number;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean; // morceau en cours de lecture
}) {
  const box = size === '100%' ? { width: '100%' as const, aspectRatio: 1 } : { width: size, height: size };
  return (
    <View style={[styles.box, box, { borderRadius: rounded }, highlight && styles.highlight, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Icon name="disc" size={typeof size === 'number' ? Math.max(14, size * 0.42) : 96} color={highlight ? colors.accent : colors.textFaint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: { borderWidth: 2, borderColor: colors.accent },
});
