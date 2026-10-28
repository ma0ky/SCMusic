// Barre de lecture persistante en bas de l'écran. Appui = ouvre le lecteur plein écran.
import { useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { getPlayer } from '@/player/engine';
import { useCurrentTrack, usePlayerStore } from '@/store/usePlayerStore';
import { colors, layout, space } from '@/theme/tokens';
import { GlassCard, IconButton, Txt } from './ui';

export function MiniPlayer() {
  const track = useCurrentTrack();
  const status = useAudioPlayerStatus(getPlayer());
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  if (!track) return null;

  const pct = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;
  return (
    <GlassCard strong style={styles.card}>
      <Pressable style={styles.row} onPress={() => router.push('/player')} accessibilityLabel="Ouvrir le lecteur">
        <View style={styles.text}>
          <Txt numberOfLines={1}>{track.title}</Txt>
          <Txt variant="muted" numberOfLines={1}>{track.artist}</Txt>
        </View>
        <IconButton name={status.playing ? 'pause' : 'play'} label={status.playing ? 'Pause' : 'Lecture'} onPress={togglePlay} />
        <IconButton name="next" label="Suivant" onPress={next} />
      </Pressable>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.sm, marginBottom: space.xs },
  row: { height: layout.miniPlayerHeight, flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, paddingRight: space.xs },
  text: { flex: 1, gap: 2 },
  progress: { height: 2, backgroundColor: colors.glassBorder },
  progressFill: { height: '100%', backgroundColor: colors.accent },
});
