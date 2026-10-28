// Paroles du morceau en cours : coller ou chercher le texte, puis le synchroniser au doigt.
// Synchro : la musique joue, on touche "Ligne suivante" au moment où chaque ligne commence.
import { useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/Header';
import { Background } from '@/components/Screen';
import { Button, EmptyState, formatTime, GlassCard, Txt } from '@/components/ui';
import { setTrackLyrics, trackLyrics } from '@/db/queries';
import { searchLyricsOnline } from '@/library/lrclib';
import { cleanLyrics, lyricsToPlainText, toLrc } from '@/library/lyrics';
import { getPlayer } from '@/player/engine';
import { useCurrentTrack, usePlayerStore } from '@/store/usePlayerStore';
import { colors, font, fontFamily, layout, radius, space } from '@/theme/tokens';

/** "Annuler" revient un peu avant la ligne annulée pour pouvoir la retoucher. */
const UNDO_REWIND = 2;

export default function LyricsEdit() {
  const insets = useSafeAreaInsets();
  const track = useCurrentTrack();
  const status = useAudioPlayerStatus(getPlayer());
  const { seek, libraryChanged } = usePlayerStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [times, setTimes] = useState<number[]>([]);
  const trackId = track?.id;

  // Préremplit avec les paroles déjà connues (sans leurs horodatages)
  useEffect(() => {
    if (trackId == null) return;
    trackLyrics(trackId).then((t) => t && setText(lyricsToPlainText(t))).catch(() => {});
  }, [trackId]);

  if (!track) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Background />
        <DetailHeader title="Paroles" icon="down" />
        <EmptyState icon="lyrics" title="Rien en lecture" text="Lance un morceau pour écrire ou synchroniser ses paroles." />
      </View>
    );
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const save = async (lyrics: string | null) => {
    await setTrackLyrics(track.id, lyrics);
    libraryChanged();
    router.back();
  };

  const searchOnline = async () => {
    setBusy(true);
    try {
      const found = await searchLyricsOnline(track);
      if (!found) {
        Alert.alert('Rien trouvé', `Pas de paroles sur LRCLIB pour « ${track.title} ». Colle-les depuis un site, puis synchronise-les.`);
      } else if (found.synced) {
        Alert.alert('Paroles synchronisées trouvées', `Source : ${found.source}`, [
          { text: 'Voir le texte', style: 'cancel', onPress: () => setText(lyricsToPlainText(found.text)) },
          { text: 'Enregistrer', onPress: () => save(found.text) },
        ]);
      } else {
        setText(found.text);
        Alert.alert('Texte trouvé', `Source : ${found.source}\nCes paroles ne sont pas synchronisées : touche « Synchroniser » pour le faire au doigt.`);
      }
    } catch (e) {
      Alert.alert('Recherche impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const startSync = () => {
    setTimes([]);
    setSyncing(true);
    seek(0);
    getPlayer().play();
  };

  const tap = () => {
    if (times.length >= lines.length) return;
    // Lu directement sur le lecteur : plus précis que le statut, rafraîchi toutes les 250 ms
    setTimes([...times, getPlayer().currentTime]);
  };

  const undo = () => {
    if (!times.length) return;
    const last = times[times.length - 1];
    setTimes(times.slice(0, -1));
    seek(Math.max(0, last - UNDO_REWIND));
  };

  const finish = () => {
    getPlayer().pause();
    save(toLrc(times.map((time, i) => ({ time, text: lines[i] }))));
  };

  if (syncing) {
    const next = times.length;
    const done = next >= lines.length;
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
        <Background />
        <DetailHeader
          title="Synchronisation"
          subtitle={`${Math.min(next, lines.length)} / ${lines.length} lignes · ${formatTime(status.currentTime)}`}
          icon="back"
          onBack={() => {
            getPlayer().pause();
            setSyncing(false);
          }}
        />
        <View style={styles.body}>
          <GlassCard style={styles.preview}>
            <View style={styles.previewInner}>
              {lines[next - 1] ? <Txt style={styles.prevLine} numberOfLines={2}>{lines[next - 1]}</Txt> : null}
              <Txt variant="caption">{done ? 'Terminé' : 'Touche quand cette ligne commence'}</Txt>
              <Txt style={styles.nextLine} numberOfLines={3}>{done ? 'Toutes les lignes sont placées.' : lines[next]}</Txt>
              {lines[next + 1] ? <Txt style={styles.prevLine} numberOfLines={2}>{lines[next + 1]}</Txt> : null}
            </View>
          </GlassCard>

          <Pressable
            onPress={done ? finish : tap}
            accessibilityRole="button"
            accessibilityLabel={done ? 'Enregistrer' : 'Ligne suivante'}
            style={({ pressed }) => [styles.tap, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Txt style={styles.tapText}>{done ? 'Enregistrer' : 'Ligne suivante'}</Txt>
          </Pressable>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button title="Annuler la ligne" kind="ghost" icon="back" onPress={undo} disabled={!times.length} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={status.playing ? 'Pause' : 'Lecture'} kind="ghost" icon={status.playing ? 'pause' : 'play'} onPress={() => (status.playing ? getPlayer().pause() : getPlayer().play())} />
            </View>
          </View>
          <Button title="Recommencer" kind="ghost" onPress={startSync} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
        <Background />
        <DetailHeader title="Paroles" subtitle={`${track.artist} – ${track.title}`} icon="down" />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Button title={busy ? 'Recherche…' : 'Chercher en ligne (LRCLIB)'} icon="search" onPress={searchOnline} disabled={busy} />
          <Txt variant="muted">Envoie seulement le titre et l’artiste à lrclib.net. Sinon, colle le texte copié depuis un site :</Txt>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder={'Une ligne de paroles par ligne…'}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            textAlignVertical="top"
            autoCorrect={false}
          />
          <Button title="Synchroniser au doigt" icon="lyrics" onPress={startSync} disabled={!lines.length} />
          <Button title="Enregistrer sans synchro" kind="ghost" onPress={() => save(cleanLyrics(text))} disabled={!lines.length} />
          <Button
            title="Retirer les paroles"
            kind="danger"
            icon="trash"
            onPress={() =>
              Alert.alert('Retirer les paroles ?', track.title, [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Retirer', style: 'destructive', onPress: () => save(null) },
              ])
            }
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  form: { padding: layout.gutter, gap: space.md },
  input: {
    minHeight: 260,
    fontFamily,
    fontSize: font.md,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  body: { flex: 1, padding: layout.gutter, gap: space.lg, justifyContent: 'space-between' },
  preview: { flex: 1 },
  previewInner: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md },
  prevLine: { fontSize: font.md, color: colors.textFaint },
  nextLine: { fontSize: font.xl, fontWeight: '700', color: colors.text, lineHeight: 32 },
  tap: {
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapText: { fontSize: font.xl, fontWeight: '700', color: colors.bg },
  row: { flexDirection: 'row', gap: space.md },
});
