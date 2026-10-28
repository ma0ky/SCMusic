// Détail d'une playlist : lecture, renommage, suppression, réorganisation des titres.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { DetailHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { PromptSheet, Sheet, SheetItem } from '@/components/Sheet';
import { TrackList } from '@/components/TrackList';
import { Button, EmptyState, IconButton } from '@/components/ui';
import { deletePlaylist, playlist, playlistTracks, renamePlaylist, setPlaylistTracks } from '@/db/queries';
import type { Playlist, Track } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, space } from '@/theme/tokens';

export default function PlaylistScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data } = useLibrary(
    async () => ({ info: await playlist(id), tracks: await playlistTracks(id) }),
    { info: null as Playlist | null, tracks: [] as Track[] },
    [id],
  );
  const { info, tracks } = data;

  const save = async (ids: number[]) => {
    await setPlaylistTracks(id, ids);
    libraryChanged();
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= tracks.length) return;
    const ids = tracks.map((t) => t.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    save(ids);
  };
  const removeAt = (index: number) => save(tracks.filter((_, i) => i !== index).map((t) => t.id));

  const confirmDelete = () => {
    setMenu(false);
    Alert.alert('Supprimer la playlist ?', `« ${info?.name} » sera supprimée. Les morceaux restent dans ta bibliothèque.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deletePlaylist(id);
          libraryChanged();
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <DetailHeader
        title={info?.name ?? ''}
        subtitle={`${tracks.length} titre${tracks.length > 1 ? 's' : ''}`}
        right={
          editing
            ? <Button title="OK" onPress={() => setEditing(false)} />
            : <IconButton name="more" label="Options de la playlist" onPress={() => setMenu(true)} />
        }
      />
      <TrackList
        tracks={tracks}
        header={
          tracks.length > 0 && !editing ? (
            <View style={{ padding: space.md }}>
              <Button title="Lire la playlist" icon="play" onPress={() => playTracks(tracks)} />
            </View>
          ) : undefined
        }
        empty={<EmptyState icon="playlist" title="Playlist vide" text="Ajoute des titres depuis le menu … d'un morceau." />}
        renderRight={
          editing
            ? (_t, i) => (
                <View style={{ flexDirection: 'row' }}>
                  <IconButton name="up" label="Monter" onPress={() => move(i, i - 1)} color={i === 0 ? colors.textFaint : colors.text} />
                  <IconButton name="down" label="Descendre" onPress={() => move(i, i + 1)} color={i === tracks.length - 1 ? colors.textFaint : colors.text} />
                  <IconButton name="trash" label="Retirer" onPress={() => removeAt(i)} color={colors.danger} />
                </View>
              )
            : undefined
        }
        menuExtra={(t, close) => (
          <SheetItem icon="trash" label="Retirer de la playlist" danger onPress={() => { removeAt(tracks.indexOf(t)); close(); }} />
        )}
      />

      <Sheet visible={menu} onClose={() => setMenu(false)} title={info?.name}>
        <SheetItem icon="edit" label="Renommer" onPress={() => { setMenu(false); setRenaming(true); }} />
        <SheetItem icon="up" label="Réorganiser / retirer des titres" onPress={() => { setMenu(false); setEditing(true); }} />
        <SheetItem icon="trash" label="Supprimer la playlist" danger onPress={confirmDelete} />
      </Sheet>
      <PromptSheet
        visible={renaming}
        title="Renommer la playlist"
        initial={info?.name}
        onClose={() => setRenaming(false)}
        onSubmit={async (name) => {
          await renamePlaylist(id, name);
          setRenaming(false);
          libraryChanged();
        }}
      />
    </Screen>
  );
}
