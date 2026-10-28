// Bibliothèque : titres, albums, artistes et titres aimés.
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { PageTitle } from '@/components/Header';
import { Cover } from '@/components/Cover';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TrackList } from '@/components/TrackList';
import { EmptyState, Txt } from '@/components/ui';
import { albums, allTracks, artists, likedTracks } from '@/db/queries';
import type { AlbumSummary, ArtistSummary, Track } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { colors, layout, radius, space } from '@/theme/tokens';

type Tab = 'tracks' | 'albums' | 'artists' | 'liked';
const TABS: { key: Tab; label: string }[] = [
  { key: 'tracks', label: 'Titres' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artistes' },
  { key: 'liked', label: 'Aimés' },
];

function Segments({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={styles.segments}>
      {TABS.map((t) => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.segment, on && styles.segmentOn]} accessibilityState={{ selected: on }}>
            <Txt style={{ color: on ? colors.bg : colors.textMuted, fontWeight: '700', fontSize: 13 }}>{t.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function GroupRow({ icon, title, subtitle, onPress, coverUri }: { icon: 'disc' | 'user'; title: string; subtitle: string; onPress: () => void; coverUri?: string | null }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.group, pressed && { backgroundColor: colors.glass }]}>
      {coverUri ? (
        <Cover uri={coverUri} size={48} />
      ) : (
        <View style={styles.groupIcon}>
          <Icon name={icon} size={20} color={colors.accent} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1}>{title}</Txt>
        <Txt variant="muted" numberOfLines={1}>{subtitle}</Txt>
      </View>
    </Pressable>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export default function Library() {
  const [tab, setTab] = useState<Tab>('tracks');
  const { data } = useLibrary(
    async () => {
      if (tab === 'albums') return { albums: await albums() };
      if (tab === 'artists') return { artists: await artists() };
      return { tracks: tab === 'liked' ? await likedTracks() : await allTracks() };
    },
    {} as { tracks?: Track[]; albums?: AlbumSummary[]; artists?: ArtistSummary[] },
    [tab],
  );

  const empty = <EmptyState icon="library" title="Rien ici pour l'instant" text={tab === 'liked' ? 'Appuie sur ♥ dans le lecteur pour aimer un titre.' : 'Scanne ton dossier musique depuis les réglages.'} />;
  const listStyle = { paddingHorizontal: space.sm, paddingBottom: layout.contentBottom };

  return (
    <Screen>
      <PageTitle title="Bibliothèque" />
      <Segments value={tab} onChange={setTab} />
      {(tab === 'tracks' || tab === 'liked') && <TrackList tracks={data.tracks ?? []} empty={empty} />}
      {tab === 'albums' && (
        <FlatList
          data={data.albums ?? []}
          keyExtractor={(a) => a.album}
          contentContainerStyle={listStyle}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <GroupRow icon="disc" coverUri={item.coverUri} title={item.album} subtitle={`${item.artist} · ${plural(item.trackCount, 'titre')}`}
              onPress={() => router.push({ pathname: '/album/[id]', params: { id: item.album } })} />
          )}
        />
      )}
      {tab === 'artists' && (
        <FlatList
          data={data.artists ?? []}
          keyExtractor={(a) => a.artist}
          contentContainerStyle={listStyle}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <GroupRow icon="user" title={item.artist} subtitle={`${plural(item.albumCount, 'album')} · ${plural(item.trackCount, 'titre')}`}
              onPress={() => router.push({ pathname: '/artist/[id]', params: { id: item.artist } })} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    marginHorizontal: layout.gutter,
    marginBottom: space.md,
    padding: space.xs,
    gap: space.xs,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.accent },
  group: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.rowHeight, paddingHorizontal: space.sm, borderRadius: radius.md },
  groupIcon: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
});
