// Onglets du bas, avec le mini-lecteur posé juste au-dessus.
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { MiniPlayer } from '@/components/MiniPlayer';
import { GlassCard, Txt } from '@/components/ui';
import { colors, layout, space } from '@/theme/tokens';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Accueil', icon: 'home' },
  search: { label: 'Recherche', icon: 'search' },
  library: { label: 'Biblio', icon: 'library' },
  playlists: { label: 'Playlists', icon: 'playlist' },
};

function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <MiniPlayer />
      <GlassCard strong style={styles.bar}>
        <View style={styles.row}>
          {state.routes.map((route, i) => {
            const tab = TABS[route.name];
            if (!tab) return null;
            const focused = state.index === i;
            const color = focused ? colors.accent : colors.textMuted;
            return (
              <Pressable
                key={route.key}
                onPress={() => navigateToTab(route.key)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
              >
                <Icon name={tab.icon} size={22} color={color} />
                <Txt style={{ color, fontSize: 10 }}>{tab.label}</Txt>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="playlists" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { marginHorizontal: space.sm, marginBottom: space.sm },
  row: { height: layout.tabBarHeight, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
});
