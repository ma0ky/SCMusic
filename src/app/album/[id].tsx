// Détail d'un album (l'identifiant de route est le nom de l'album).
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Cover } from '@/components/Cover';
import { DetailHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TrackList } from '@/components/TrackList';
import { Button } from '@/components/ui';
import { albumTracks } from '@/db/queries';
import type { Track } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { radius, space } from '@/theme/tokens';

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playTracks = usePlayerStore((s) => s.playTracks);
  const { data: tracks } = useLibrary(() => albumTracks(id), [] as Track[], [id]);

  return (
    <Screen>
      <DetailHeader title={id} subtitle={tracks[0] ? `${tracks[0].artist} · ${tracks.length} titres` : undefined} />
      <TrackList
        tracks={tracks}
        header={
          <View style={{ padding: space.md, gap: space.lg, alignItems: 'center' }}>
            <Cover uri={tracks.find((t) => t.coverUri)?.coverUri} size={220} rounded={radius.lg} />
            <View style={{ alignSelf: 'stretch' }}>
              <Button title="Lire l'album" icon="play" onPress={() => playTracks(tracks)} disabled={tracks.length === 0} />
            </View>
          </View>
        }
      />
    </Screen>
  );
}
