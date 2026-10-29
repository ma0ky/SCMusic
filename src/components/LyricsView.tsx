// Paroles du morceau en cours : la ligne chantée est mise en avant et reste centrée.
// Toucher une ligne synchronisée y déplace la lecture. Défiler à la main suspend le suivi quelques secondes.
// Sans paroles : recherche en ligne (LRCLIB) à la demande, ou écran pour les coller et les synchroniser.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';
import { setTrackLyrics, trackLyrics } from '@/db/queries';
import type { Track } from '@/db/types';
import { formatDay, searchLyricsOnline } from '@/library/lrclib';
import { activeLineIndex, parseLyrics, type Lyrics } from '@/library/lyrics';
import { colors, font, space } from '@/theme/tokens';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button, EmptyState, GlassCard, Txt } from './ui';

/** Durée pendant laquelle le défilement manuel l'emporte sur le suivi automatique. */
const MANUAL_SCROLL_MS = 3000;

interface Props {
  track: Track;
  position: number; // secondes
  onSeek: (seconds: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function LyricsView({ track, position, onSeek, style }: Props) {
  const trackId = track.id;
  const libraryVersion = usePlayerStore((s) => s.libraryVersion); // rechargées après une modification
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const [searching, setSearching] = useState(false);
  // Paroles chargées et le morceau auquel elles appartiennent (autre morceau = chargement en cours)
  const [loaded, setLoaded] = useState<{ trackId: number; lyrics: Lyrics | null } | null>(null);
  const lyrics = loaded?.trackId === trackId ? loaded.lyrics : undefined;
  const scroll = useRef<ScrollViewInstance>(null);
  const lineY = useRef<number[]>([]);
  const viewHeight = useRef(0);
  const manualUntil = useRef(0);

  useEffect(() => {
    let alive = true;
    lineY.current = [];
    trackLyrics(trackId)
      .then((text) => alive && setLoaded({ trackId, lyrics: text ? parseLyrics(text) : null }))
      .catch(() => alive && setLoaded({ trackId, lyrics: null }));
    return () => {
      alive = false;
    };
  }, [trackId, libraryVersion]);

  const active = useMemo(() => (lyrics?.synced ? activeLineIndex(lyrics.lines, position) : -1), [lyrics, position]);

  useEffect(() => {
    if (active < 0 || Date.now() < manualUntil.current) return;
    const y = lineY.current[active];
    if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - viewHeight.current / 3), animated: true });
  }, [active]);

  const searchOnline = async (force = false) => {
    setSearching(true);
    try {
      const result = await searchLyricsOnline(track, force);
      if (result.kind === 'already') {
        Alert.alert('Déjà cherché', `LRCLIB n'avait rien pour « ${track.title} » le ${formatDay(result.at)}. Pour ne pas redemander, rien n'a été envoyé.`, [
          { text: 'Coller', onPress: () => router.push('/lyrics-edit') },
          { text: 'Annuler', style: 'cancel' },
          { text: 'Chercher quand même', onPress: () => searchOnline(true) },
        ]);
      } else if (result.kind === 'found') {
        const found = result.lyrics;
        await setTrackLyrics(track.id, found.text);
        libraryChanged();
        if (!found.synced) {
          Alert.alert('Texte trouvé, sans synchro', `Source : ${found.source}`, [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Synchroniser', onPress: () => router.push('/lyrics-edit') },
          ]);
        }
      } else {
        Alert.alert('Rien trouvé', `Pas de paroles sur LRCLIB pour « ${track.title} ». Tu peux les coller depuis un site.`, [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Coller', onPress: () => router.push('/lyrics-edit') },
        ]);
      }
    } catch (e) {
      Alert.alert('Recherche impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  if (lyrics === undefined) return <GlassCard style={[styles.card, style]}>{null}</GlassCard>;
  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <GlassCard style={[styles.card, style]}>
        <EmptyState icon="lyrics" title="Pas de paroles" text="Cherche-les en ligne, colle-les depuis un site, ou ajoute un fichier nom.lrc à côté de nom.mp3.">
          <View style={styles.actions}>
            <Button title={searching ? 'Recherche…' : 'Chercher en ligne'} icon="search" onPress={() => searchOnline()} disabled={searching} />
            <Button title="Coller / écrire" kind="ghost" icon="edit" onPress={() => router.push('/lyrics-edit')} />
          </View>
        </EmptyState>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={[styles.card, style]}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => (viewHeight.current = e.nativeEvent.layout.height)}
        onScrollBeginDrag={() => (manualUntil.current = Date.now() + MANUAL_SCROLL_MS)}
        onMomentumScrollEnd={() => (manualUntil.current = Date.now() + MANUAL_SCROLL_MS)}
      >
        {lyrics.lines.map((line, i) => {
          const past = lyrics.synced && i < active;
          const current = i === active;
          const text = line.text || (lyrics.synced ? '♪' : ' ');
          return (
            <View key={i} onLayout={(e) => (lineY.current[i] = e.nativeEvent.layout.y)}>
              {line.time != null ? (
                <Pressable
                  onPress={() => {
                    manualUntil.current = 0;
                    onSeek(line.time!);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Aller à : ${line.text || 'pause instrumentale'}`}
                >
                  <Txt style={[styles.synced, past && styles.past, current && styles.current]}>{text}</Txt>
                </Pressable>
              ) : (
                <Txt style={styles.plain}>{text}</Txt>
              )}
            </View>
          );
        })}
        <View style={styles.footer}>
          {!lyrics.synced ? <Txt variant="muted" style={styles.note}>Paroles non synchronisées</Txt> : null}
          <Button
            title={lyrics.synced ? 'Modifier les paroles' : 'Synchroniser au doigt'}
            kind={lyrics.synced ? 'ghost' : 'primary'}
            icon="edit"
            onPress={() => router.push('/lyrics-edit')}
          />
        </View>
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, paddingVertical: space.xl, gap: space.md },
  synced: { fontSize: font.lg, fontWeight: '700', color: colors.textFaint, lineHeight: 26 },
  past: { color: colors.textMuted },
  current: { color: colors.text, fontSize: font.xl, lineHeight: 32 },
  plain: { fontSize: font.md, color: colors.text, lineHeight: 22 },
  note: { textAlign: 'center' },
  footer: { marginTop: space.xl, gap: space.md },
  actions: { alignSelf: 'stretch', gap: space.sm },
});
