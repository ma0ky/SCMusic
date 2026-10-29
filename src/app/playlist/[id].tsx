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
import { useT } from '@/i18n';

export default function PlaylistScreen() {
  const t = useT();
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
    const ids = tracks.map((track) => track.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    save(ids);
  };
  const removeAt = (index: number) => save(tracks.filter((_, i) => i !== index).map((track) => track.id));

  const confirmDelete = () => {
    setMenu(false);
    Alert.alert(t.playlists.deleteConfirm, t.playlists.deleteText(info?.name ?? ''), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
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
        subtitle={t.common.tracks(tracks.length)}
        right={
          editing
            ? <Button title="OK" onPress={() => setEditing(false)} />
            : <IconButton name="more" label={t.playlists.options} onPress={() => setMenu(true)} />
        }
      />
      <TrackList
        tracks={tracks}
        header={
          tracks.length > 0 && !editing ? (
            <View style={{ padding: space.md }}>
              <Button title={t.playlists.play} icon="play" onPress={() => playTracks(tracks)} />
            </View>
          ) : undefined
        }
        empty={<EmptyState icon="playlist" title={t.playlists.empty} text={t.playlists.emptyText} />}
        renderRight={
          editing
            ? (_t, i) => (
                <View style={{ flexDirection: 'row' }}>
                  <IconButton name="up" label={t.common.moveUp} onPress={() => move(i, i - 1)} color={i === 0 ? colors.textFaint : colors.text} />
                  <IconButton name="down" label={t.common.moveDown} onPress={() => move(i, i + 1)} color={i === tracks.length - 1 ? colors.textFaint : colors.text} />
                  <IconButton name="trash" label={t.common.remove} onPress={() => removeAt(i)} color={colors.danger} />
                </View>
              )
            : undefined
        }
        menuExtra={(track, close) => (
          <SheetItem icon="trash" label={t.playlists.removeFrom} danger onPress={() => { removeAt(tracks.indexOf(track)); close(); }} />
        )}
      />

      <Sheet visible={menu} onClose={() => setMenu(false)} title={info?.name}>
        <SheetItem icon="edit" label={t.common.rename} onPress={() => { setMenu(false); setRenaming(true); }} />
        <SheetItem icon="up" label={t.playlists.reorder} onPress={() => { setMenu(false); setEditing(true); }} />
        <SheetItem icon="trash" label={t.playlists.delete} danger onPress={confirmDelete} />
      </Sheet>
      <PromptSheet
        visible={renaming}
        title={t.playlists.renameTitle}
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
