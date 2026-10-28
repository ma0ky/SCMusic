// Recherche dans les titres, artistes et albums (index en mémoire).
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { PageTitle } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TrackMenu } from '@/components/Sheet';
import { TrackRow } from '@/components/TrackRow';
import { EmptyState, GlassCard, SectionTitle, Txt } from '@/components/ui';
import { allTracks } from '@/db/queries';
import type { Track } from '@/db/types';
import { search } from '@/search/search';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, font, fontFamily, layout, radius, space } from '@/theme/tokens';

export default function Search() {
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<Track | null>(null);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const { data: tracks } = useLibrary(allTracks, [] as Track[]);
  const results = useMemo(() => search(tracks, query), [tracks, query]);
  const nothing = query.trim() !== '' && results.tracks.length + results.artists.length + results.albums.length === 0;

  return (
    <Screen>
      <PageTitle title="Recherche" />
      <View style={{ paddingHorizontal: layout.gutter }}>
        <GlassCard style={styles.inputWrap}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Titre, artiste, album…"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </GlassCard>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: layout.contentBottom }}>
        {nothing && <EmptyState icon="search" title="Aucun résultat" text={`Rien ne correspond à « ${query} ».`} />}
        {results.artists.length > 0 && <SectionTitle>Artistes</SectionTitle>}
        {results.artists.map((a) => (
          <Pressable key={a} style={styles.link} onPress={() => router.push({ pathname: '/artist/[id]', params: { id: a } })}>
            <Icon name="user" size={20} color={colors.accent} />
            <Txt numberOfLines={1}>{a}</Txt>
          </Pressable>
        ))}
        {results.albums.length > 0 && <SectionTitle>Albums</SectionTitle>}
        {results.albums.map((a) => (
          <Pressable key={`${a.album}-${a.artist}`} style={styles.link} onPress={() => router.push({ pathname: '/album/[id]', params: { id: a.album } })}>
            <Icon name="disc" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Txt numberOfLines={1}>{a.album}</Txt>
              <Txt variant="muted" numberOfLines={1}>{a.artist}</Txt>
            </View>
          </Pressable>
        ))}
        {results.tracks.length > 0 && <SectionTitle>Titres</SectionTitle>}
        {results.tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} onPress={() => playTracks(results.tracks, i)} onMore={() => setMenuFor(t)} />
        ))}
      </ScrollView>
      <TrackMenu track={menuFor} onClose={() => setMenuFor(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  input: { flex: 1, fontFamily, fontSize: font.md, color: colors.text, paddingVertical: space.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.md },
});
