// Liste des playlists + création.
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { PageTitle } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { PromptSheet } from '@/components/Sheet';
import { EmptyState, IconButton, Txt } from '@/components/ui';
import { createPlaylist, playlists } from '@/db/queries';
import type { Playlist } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, layout, radius, space } from '@/theme/tokens';
import { useT } from '@/i18n';

export default function Playlists() {
  const t = useT();
  const [creating, setCreating] = useState(false);
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const { data } = useLibrary(playlists, [] as Playlist[]);

  return (
    <Screen>
      <PageTitle title={t.tabs.playlists} right={<IconButton name="plus" label={t.common.newPlaylist} onPress={() => setCreating(true)} />} />
      <FlatList
        data={data}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ paddingHorizontal: space.sm, paddingBottom: layout.contentBottom }}
        ListEmptyComponent={<EmptyState icon="playlist" title={t.playlists.none} text={t.playlists.noneText} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: String(item.id) } })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.glass }]}
          >
            <View style={styles.icon}>
              <Icon name="playlist" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt numberOfLines={1}>{item.name}</Txt>
              <Txt variant="muted">{t.common.tracks(item.trackCount)}</Txt>
            </View>
          </Pressable>
        )}
      />
      <PromptSheet
        visible={creating}
        title={t.common.newPlaylist}
        confirmLabel={t.common.create}
        onClose={() => setCreating(false)}
        onSubmit={async (name) => {
          const id = await createPlaylist(name);
          setCreating(false);
          libraryChanged();
          router.push({ pathname: '/playlist/[id]', params: { id: String(id) } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 68, paddingHorizontal: space.sm, borderRadius: radius.md },
  icon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
