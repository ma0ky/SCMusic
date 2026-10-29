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
import { formatDay, searchLyricsOnline } from '@/library/lrclib';
import { cleanLyrics, lyricsToPlainText, MAX_LYRICS_CHARS, toLrc } from '@/library/lyrics';
import { getPlayer } from '@/player/engine';
import { useCurrentTrack, usePlayerStore } from '@/store/usePlayerStore';
import { colors, font, fontFamily, layout, radius, space } from '@/theme/tokens';
import { useT } from '@/i18n';

/** "Annuler" revient un peu avant la ligne annulée pour pouvoir la retoucher. */
const UNDO_REWIND = 2;

export default function LyricsEdit() {
  const insets = useSafeAreaInsets();
  const t = useT();
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
    trackLyrics(trackId).then((saved) => saved && setText(lyricsToPlainText(saved))).catch(() => {});
  }, [trackId]);

  if (!track) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Background />
        <DetailHeader title={t.lyrics.title} icon="down" />
        <EmptyState icon="lyrics" title={t.common.nothingPlaying} text={t.lyrics.noTrackText} />
      </View>
    );
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const save = async (lyrics: string | null) => {
    await setTrackLyrics(track.id, lyrics);
    libraryChanged();
    router.back();
  };

  const searchOnline = async (force = false) => {
    setBusy(true);
    try {
      const result = await searchLyricsOnline(track, force);
      const found = result.kind === 'found' ? result.lyrics : null;
      if (result.kind === 'already') {
        Alert.alert(t.lyrics.already, t.lyrics.alreadyText(track.title, formatDay(result.at)), [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.lyrics.searchAnyway, onPress: () => searchOnline(true) },
        ]);
      } else if (!found) {
        Alert.alert(t.lyrics.notFound, t.lyrics.notFoundSync(track.title));
      } else if (found.synced) {
        Alert.alert(t.lyrics.foundSynced, t.lyrics.source(found.source), [
          { text: t.lyrics.viewText, style: 'cancel', onPress: () => setText(lyricsToPlainText(found.text)) },
          { text: t.common.save, onPress: () => save(found.text) },
        ]);
      } else {
        setText(found.text);
        Alert.alert(t.lyrics.foundText, t.lyrics.sourceNotSynced(found.source));
      }
    } catch (e) {
      Alert.alert(t.lyrics.searchFailed, e instanceof Error ? e.message : String(e));
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
          title={t.lyrics.syncTitle}
          subtitle={t.lyrics.syncProgress(Math.min(next, lines.length), lines.length, formatTime(status.currentTime))}
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
              <Txt variant="caption">{done ? t.lyrics.finished : t.lyrics.tapWhen}</Txt>
              <Txt style={styles.nextLine} numberOfLines={3}>{done ? t.lyrics.allPlaced : lines[next]}</Txt>
              {lines[next + 1] ? <Txt style={styles.prevLine} numberOfLines={2}>{lines[next + 1]}</Txt> : null}
            </View>
          </GlassCard>

          <Pressable
            onPress={done ? finish : tap}
            accessibilityRole="button"
            accessibilityLabel={done ? t.common.save : t.lyrics.nextLine}
            style={({ pressed }) => [styles.tap, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Txt style={styles.tapText}>{done ? t.common.save : t.lyrics.nextLine}</Txt>
          </Pressable>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button title={t.lyrics.undoLine} kind="ghost" icon="back" onPress={undo} disabled={!times.length} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={status.playing ? t.common.pause : t.common.play} kind="ghost" icon={status.playing ? 'pause' : 'play'} onPress={() => (status.playing ? getPlayer().pause() : getPlayer().play())} />
            </View>
          </View>
          <Button title={t.lyrics.restart} kind="ghost" onPress={startSync} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
        <Background />
        <DetailHeader title={t.lyrics.title} subtitle={`${track.artist} – ${track.title}`} icon="down" />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Button title={busy ? t.common.searching : t.lyrics.searchLrclib} icon="search" onPress={() => searchOnline()} disabled={busy} />
          <Txt variant="muted">{t.lyrics.privacy}</Txt>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_LYRICS_CHARS}
            multiline
            placeholder={t.lyrics.placeholder}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            textAlignVertical="top"
            autoCorrect={false}
          />
          <Button title={t.lyrics.syncByHand} icon="lyrics" onPress={startSync} disabled={!lines.length} />
          <Button title={t.lyrics.saveUnsynced} kind="ghost" onPress={() => save(cleanLyrics(text))} disabled={!lines.length} />
          <Button
            title={t.lyrics.removeAll}
            kind="danger"
            icon="trash"
            onPress={() =>
              Alert.alert(t.lyrics.removeConfirm, track.title, [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.common.remove, style: 'destructive', onPress: () => save(null) },
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
