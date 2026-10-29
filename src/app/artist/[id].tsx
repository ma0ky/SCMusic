// Détail d'un artiste : tous ses titres, classés par album.
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { DetailHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TrackList } from '@/components/TrackList';
import { Button } from '@/components/ui';
import { artistTracks } from '@/db/queries';
import type { Track } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { space } from '@/theme/tokens';
import { useT } from '@/i18n';

export default function Artist() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playTracks = usePlayerStore((s) => s.playTracks);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const { data: tracks } = useLibrary(() => artistTracks(id), [] as Track[], [id]);

  const shufflePlay = () => {
    if (!usePlayerStore.getState().queue.shuffle) toggleShuffle();
    playTracks(tracks, Math.floor(Math.random() * tracks.length));
  };

  return (
    <Screen>
      <DetailHeader title={id} subtitle={t.common.tracks(tracks.length)} />
      <TrackList
        tracks={tracks}
        header={
          <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md }}>
            <View style={{ flex: 1 }}><Button title={t.artist.play} icon="play" onPress={() => playTracks(tracks)} disabled={tracks.length === 0} /></View>
            <View style={{ flex: 1 }}><Button title={t.common.shuffle} icon="shuffle" kind="ghost" onPress={shufflePlay} disabled={tracks.length === 0} /></View>
          </View>
        }
      />
    </Screen>
  );
}
