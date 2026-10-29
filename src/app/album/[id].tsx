// Détail d'un album (l'identifiant de route est le nom de l'album).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Cover } from '@/components/Cover';
import { DetailHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TrackList } from '@/components/TrackList';
import { Button, IconButton } from '@/components/ui';
import { albumTracks } from '@/db/queries';
import type { Track } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { radius, space } from '@/theme/tokens';

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playTracks = usePlayerStore((s) => s.playTracks);
  const { data: tracks } = useLibrary(() => albumTracks(id), [] as Track[], [id]);
  const renamed = usePlayerStore((s) => s.albumRenamed);

  // Album renommé depuis cet écran : on affiche l'album sous son nouveau nom
  useEffect(() => {
    if (renamed && renamed.from === id) router.setParams({ id: renamed.to });
  }, [renamed, id]);

  return (
    <Screen>
      <DetailHeader
        title={id}
        subtitle={tracks[0] ? `${tracks[0].artist} · ${tracks.length} titres` : undefined}
        right={
          tracks.length > 0 && (
            <IconButton
              name="edit"
              label="Renommer l'album"
              onPress={() => router.push({ pathname: '/track-edit', params: { ids: tracks.map((t) => t.id).join(','), album: id } })}
            />
          )
        }
      />
      <TrackList
        tracks={tracks}
        header={
          <View style={{ padding: space.md, gap: space.lg, alignItems: 'center' }}>
            <Cover uri={tracks.find((t) => t.coverUri)?.coverUri} size={220} rounded={radius.lg} />
            <View style={{ alignSelf: 'stretch', gap: space.sm }}>
              <Button title="Lire l'album" icon="play" onPress={() => playTracks(tracks)} disabled={tracks.length === 0} />
              {id === 'Album inconnu' && tracks.length > 0 && (
                <Button
                  title="Trouver leurs albums en ligne"
                  kind="ghost"
                  icon="search"
                  onPress={() => router.push({ pathname: '/album-lookup', params: { ids: tracks.map((t) => t.id).join(',') } })}
                />
              )}
            </View>
          </View>
        }
      />
    </Screen>
  );
}
