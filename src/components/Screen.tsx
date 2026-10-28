// Conteneur d'écran : fond dégradé + marges de sécurité (encoche, barre système).
import { LinearGradient } from './LinearGradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';

export function Background() {
  return <LinearGradient style={StyleSheet.absoluteFill} from={colors.bgGradientTop} to={colors.bg} />;
}

export function Screen({ children, padTop = true }: { children: ReactNode; padTop?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Background />
      <View style={{ flex: 1, paddingTop: padTop ? insets.top + space.sm : 0 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
