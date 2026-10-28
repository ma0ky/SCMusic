// En-têtes d'écran : titre de page (onglets) ou titre avec retour (écrans de détail).
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, layout, space } from '@/theme/tokens';
import { IconButton, Txt } from './ui';

export function PageTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.page}>
      <Txt variant="title" style={{ flex: 1 }}>{title}</Txt>
      {right}
    </View>
  );
}

export function DetailHeader({ title, subtitle, right, icon = 'back' }: { title: string; subtitle?: string; right?: ReactNode; icon?: 'back' | 'down' }) {
  return (
    <View style={styles.detail}>
      <IconButton name={icon} label="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ flex: 1 }}>
        <Txt variant="heading" numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt variant="muted" numberOfLines={1}>{subtitle}</Txt> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.gutter, paddingBottom: space.md },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingBottom: space.md,
    borderBottomColor: colors.glassBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
