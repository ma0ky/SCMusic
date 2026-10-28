// Liste de morceaux complète : lecture au toucher + menu d'actions intégré.
// Utilisée par la bibliothèque, les albums, les artistes et les playlists.
import { useState, type ReactElement, type ReactNode } from 'react';
import { FlatList } from 'react-native';
import type { Track } from '@/db/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { layout, space } from '@/theme/tokens';
import { TrackMenu } from './Sheet';
import { TrackRow } from './TrackRow';

export function TrackList({
  tracks, header, empty, renderRight, menuExtra,
}: {
  tracks: Track[];
  header?: ReactElement;
  empty?: ReactElement;
  renderRight?: (t: Track, index: number) => ReactNode;
  /** Actions ajoutées au menu (ex. "Retirer de la playlist"). Reçoit le morceau et une fonction de fermeture. */
  menuExtra?: (t: Track, close: () => void) => ReactNode;
}) {
  const playTracks = usePlayerStore((s) => s.playTracks);
  const [menuFor, setMenuFor] = useState<Track | null>(null);
  const close = () => setMenuFor(null);

  return (
    <>
      <FlatList
        data={tracks}
        keyExtractor={(t, i) => `${t.id}-${i}`}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingHorizontal: space.sm, paddingBottom: layout.contentBottom }}
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            onPress={() => playTracks(tracks, index)}
            onMore={() => setMenuFor(item)}
            right={renderRight?.(item, index)}
          />
        )}
      />
      <TrackMenu track={menuFor} onClose={close} extra={menuFor && menuExtra?.(menuFor, close)} />
    </>
  );
}
