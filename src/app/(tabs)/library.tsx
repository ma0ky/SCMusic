// Bibliothèque : titres, albums, artistes et titres aimés.
// Mode sélection (titres) : cocher plusieurs titres pour modifier leurs infos d'un coup (ex. leur donner un album).
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { PageTitle } from '@/components/Header';
import { Cover } from '@/components/Cover';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TrackList } from '@/components/TrackList';
import { EmptyState, IconButton, Txt } from '@/components/ui';
import { albums, allTracks, artists, likedTracks } from '@/db/queries';
import type { AlbumSummary, ArtistSummary, Track } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { colors, layout, radius, space } from '@/theme/tokens';
import { useT } from '@/i18n';

type Tab = 'tracks' | 'albums' | 'artists' | 'liked';
const TABS: Tab[] = ['tracks', 'albums', 'artists', 'liked'];

function Segments({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const t = useT();
  return (
    <View style={styles.segments}>
      {TABS.map((tab) => {
        const on = tab === value;
        return (
          <Pressable key={tab} onPress={() => onChange(tab)} style={[styles.segment, on && styles.segmentOn]} accessibilityState={{ selected: on }}>
            <Txt style={{ color: on ? colors.bg : colors.textMuted, fontWeight: '700', fontSize: 13 }}>{t.library[tab]}</Txt>
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

export default function Library() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('tracks');
  const [selected, setSelected] = useState<Set<number> | null>(null); // null = pas en mode sélection
  const { data } = useLibrary(
    async () => {
      if (tab === 'albums') return { albums: await albums() };
      if (tab === 'artists') return { artists: await artists() };
      return { tracks: tab === 'liked' ? await likedTracks() : await allTracks() };
    },
    {} as { tracks?: Track[]; albums?: AlbumSummary[]; artists?: ArtistSummary[] },
    [tab],
  );

  const empty = <EmptyState icon="library" title={t.library.empty} text={tab === 'liked' ? t.library.emptyLiked : t.library.emptyScan} />;
  const listStyle = { paddingHorizontal: space.sm, paddingBottom: layout.contentBottom };

  const trackTab = tab === 'tracks' || tab === 'liked';
  const shown = data.tracks ?? [];
  const toggle = (track: Track) => {
    const next = new Set(selected);
    if (next.has(track.id)) next.delete(track.id);
    else next.add(track.id);
    setSelected(next);
  };
  const openWithSelection = (pathname: '/track-edit' | '/album-lookup') => {
    if (!selected?.size) return;
    router.push({ pathname, params: { ids: [...selected].join(',') } });
    setSelected(null);
  };

  const titleRight = !trackTab ? null : selected ? (
    <>
      <IconButton
        name="check"
        label={selected.size === shown.length ? t.library.deselectAll : t.library.selectAll}
        active={selected.size === shown.length && shown.length > 0}
        onPress={() => setSelected(selected.size === shown.length ? new Set() : new Set(shown.map((track) => track.id)))}
      />
      <IconButton name="search" label={t.common.findAlbumsOnline} onPress={() => openWithSelection('/album-lookup')} color={selected.size ? colors.accent : colors.textFaint} />
      <IconButton name="edit" label={t.library.editSelected} onPress={() => openWithSelection('/track-edit')} color={selected.size ? colors.accent : colors.textFaint} />
      <IconButton name="close" label={t.library.exitSelection} onPress={() => setSelected(null)} />
    </>
  ) : (
    <IconButton name="edit" label={t.library.startSelection} onPress={() => setSelected(new Set())} />
  );

  return (
    <Screen>
      <PageTitle title={selected ? t.library.selected(selected.size) : t.library.title} right={titleRight} />
      <Segments value={tab} onChange={(next) => { setTab(next); setSelected(null); }} />
      {trackTab && (
        <TrackList tracks={shown} empty={empty} selection={selected ? { selected, onToggle: toggle } : undefined} />
      )}
      {tab === 'albums' && (
        <FlatList
          data={data.albums ?? []}
          keyExtractor={(a) => a.album}
          contentContainerStyle={listStyle}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <GroupRow icon="disc" coverUri={item.coverUri} title={item.album} subtitle={`${item.artist} · ${t.common.tracks(item.trackCount)}`}
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
            <GroupRow icon="user" title={item.artist} subtitle={`${t.common.albums(item.albumCount)} · ${t.common.tracks(item.trackCount)}`}
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
