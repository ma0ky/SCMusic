// Feuilles modales : menu d'actions d'un morceau, saisie de texte, choix de playlist.
// (Les Alert natives d'Android sont limitées à 3 boutons et sans champ texte.)
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { addToPlaylist, createPlaylist, playlists as loadPlaylists } from '@/db/queries';
import type { Playlist, Track, TrackLicense } from '@/db/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, font, fontFamily, radius, space } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Button, GlassCard, Txt } from './ui';

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <GlassCard strong style={styles.sheet}>
          {title && <Txt variant="heading" numberOfLines={2} style={{ marginBottom: space.md }}>{title}</Txt>}
          {children}
        </GlassCard>
      </View>
    </Modal>
  );
}

export function SheetItem({ icon, label, onPress, danger, active }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; active?: boolean }) {
  const color = danger ? colors.danger : active ? colors.accent : colors.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.glass }]}>
      <Icon name={icon} size={20} color={color} />
      <Txt style={{ color, flex: 1 }}>{label}</Txt>
    </Pressable>
  );
}

/** Fenêtre de saisie (nom de playlist, renommage…). */
type PromptProps = {
  visible: boolean;
  title: string;
  initial?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

export function PromptSheet({ visible, title, onClose, ...rest }: PromptProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {/* monté seulement à l'ouverture : le champ repart de la valeur initiale */}
      {visible && <PromptBody onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function PromptBody({ initial = '', confirmLabel = 'Valider', onSubmit, onClose }: Omit<PromptProps, 'visible' | 'title'>) {
  const [value, setValue] = useState(initial);
  const ok = value.trim().length > 0;
  return (
    <>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoFocus
        maxLength={100}
        placeholder="Nom"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        onSubmitEditing={() => ok && onSubmit(value.trim())}
      />
      <View style={styles.actions}>
        <Button title="Annuler" kind="ghost" onPress={onClose} />
        <Button title={confirmLabel} onPress={() => onSubmit(value.trim())} disabled={!ok} />
      </View>
    </>
  );
}

const LICENSES: { value: TrackLicense; label: string }[] = [
  { value: 'personal', label: 'Achat / CD perso (non partageable)' },
  { value: 'own', label: 'Ma création (partageable)' },
  { value: 'cc', label: 'Licence libre, Creative Commons (partageable)' },
];

/** Menu d'actions d'un morceau. `extra` permet à un écran d'ajouter ses propres actions. */
type TrackMenuProps = { track: Track | null; onClose: () => void; extra?: ReactNode };

export function TrackMenu({ track, ...rest }: TrackMenuProps) {
  // une clé par morceau : le menu repart de l'écran principal à chaque ouverture
  return track ? <TrackMenuBody key={track.id} track={track} {...rest} /> : null;
}

function TrackMenuBody({ track, onClose, extra }: TrackMenuProps & { track: Track }) {
  const { playNext, enqueue, toggleLike, changeLicense, libraryChanged } = usePlayerStore.getState();
  const [mode, setMode] = useState<'main' | 'playlist' | 'license' | 'newPlaylist'>('main');
  const [lists, setLists] = useState<Playlist[]>([]);

  useEffect(() => { if (mode === 'playlist') loadPlaylists().then(setLists); }, [mode]);

  const done = () => { onClose(); setMode('main'); };
  const addTo = async (id: number) => { await addToPlaylist(id, [track.id]); libraryChanged(); done(); };

  if (mode === 'newPlaylist') {
    return (
      <PromptSheet
        visible
        title="Nouvelle playlist"
        confirmLabel="Créer"
        onClose={() => setMode('playlist')}
        onSubmit={async (name) => addTo(await createPlaylist(name))}
      />
    );
  }

  return (
    <Sheet visible onClose={done} title={`${track.title}\n${track.artist}`}>
      {mode === 'main' && (
        <>
          <SheetItem icon="queue" label="Lire ensuite" onPress={() => { playNext(track); done(); }} />
          <SheetItem icon="plus" label="Ajouter à la file" onPress={() => { enqueue(track); done(); }} />
          <SheetItem icon="playlist" label="Ajouter à une playlist" onPress={() => setMode('playlist')} />
          <SheetItem
            icon={track.liked ? 'heartFill' : 'heart'}
            label={track.liked ? 'Retirer des titres aimés' : 'Aimer'}
            active={track.liked}
            onPress={() => { toggleLike(track); done(); }}
          />
          <SheetItem icon="disc" label="Voir l'album" onPress={() => { done(); router.push({ pathname: '/album/[id]', params: { id: track.album } }); }} />
          <SheetItem icon="user" label="Voir l'artiste" onPress={() => { done(); router.push({ pathname: '/artist/[id]', params: { id: track.artist } }); }} />
          <SheetItem icon="edit" label="Licence du morceau" onPress={() => setMode('license')} />
          {extra}
        </>
      )}
      {mode === 'playlist' && (
        <ScrollView style={{ maxHeight: 360 }}>
          <SheetItem icon="plus" label="Nouvelle playlist…" active onPress={() => setMode('newPlaylist')} />
          {lists.map((p) => <SheetItem key={p.id} icon="playlist" label={p.name} onPress={() => addTo(p.id)} />)}
        </ScrollView>
      )}
      {mode === 'license' && (
        <>
          <Txt variant="muted" style={{ marginBottom: space.sm }}>
            Seuls les morceaux « Ma création » ou « Licence libre » peuvent être exportés vers une autre personne.
          </Txt>
          {LICENSES.map((l) => (
            <SheetItem
              key={l.value}
              icon={track.license === l.value ? 'heartFill' : 'disc'}
              label={l.label}
              active={track.license === l.value}
              onPress={() => { changeLicense(track, l.value); done(); }}
            />
          ))}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', padding: space.md },
  sheet: { padding: space.lg, paddingBottom: space.xl },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  input: {
    fontFamily,
    fontSize: font.md,
    color: colors.text,
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.lg },
});
