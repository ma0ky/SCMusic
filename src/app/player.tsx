// Lecteur plein écran : position, volume, précédent/suivant, aléatoire, répétition, j'aime, paroles.
import { useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Cover } from '@/components/Cover';
import { DetailHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { LyricsView } from '@/components/LyricsView';
import { Background } from '@/components/Screen';
import { SeekBar } from '@/components/SeekBar';
import { EmptyState, formatTime, GlassCard, IconButton, Txt } from '@/components/ui';
import { getPlayer } from '@/player/engine';
import { useCurrentTrack, usePlayerStore } from '@/store/usePlayerStore';
import { colors, layout, radius, space } from '@/theme/tokens';
import { useT } from '@/i18n';

/** Pochette du morceau, ou à défaut un motif généré à partir du titre. */
function Artwork({ seed, coverUri }: { seed: string; coverUri: string | null }) {
  if (coverUri) return <Cover uri={coverUri} size="100%" rounded={radius.lg} style={styles.art} />;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rings = [0, 1, 2, 3].map((i) => 40 + ((h >> (i * 5)) % 60) + i * 30);
  return (
    <GlassCard style={styles.art}>
      <Svg width="100%" height="100%" viewBox="0 0 300 300">
        {rings.map((r, i) => (
          <Circle key={i} cx={150} cy={150} r={r} fill="none" stroke={colors.accent} strokeOpacity={0.15 + i * 0.15} strokeWidth={2 + i} />
        ))}
        <Path d="M190 110 A40 40 0 1 0 150 150 A40 40 0 1 1 110 190" fill="none" stroke={colors.text} strokeWidth={14} strokeLinecap="round" />
      </Svg>
    </GlassCard>
  );
}

export default function Player() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const track = useCurrentTrack();
  const status = useAudioPlayerStatus(getPlayer());
  const s = usePlayerStore();
  const [preview, setPreview] = useState<number | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);

  if (!track) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Background />
        <DetailHeader title={t.player.title} icon="down" />
        <EmptyState icon="play" title={t.common.nothingPlaying} text={t.player.pickTrack} />
      </View>
    );
  }

  const duration = status.duration || track.duration || 0;
  const repeatIcon = s.queue.repeat === 'one' ? 'repeatOne' : 'repeat';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
      <Background />
      <DetailHeader
        title={t.player.nowPlaying}
        subtitle={`${s.queue.index + 1} / ${s.queue.order.length}`}
        icon="down"
        right={
          <>
            <IconButton
              name="lyrics"
              label={showLyrics ? t.player.hideLyrics : t.player.showLyrics}
              active={showLyrics}
              onPress={() => setShowLyrics(!showLyrics)}
            />
            <IconButton name="queue" label={t.queue.title} onPress={() => router.push('/queue')} />
          </>
        }
      />
      <View style={styles.body}>
        {showLyrics ? (
          <LyricsView track={track} position={status.currentTime} onSeek={s.seek} style={styles.lyrics} />
        ) : (
          <Artwork seed={`${track.title}${track.artist}`} coverUri={track.coverUri} />
        )}

        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" numberOfLines={2} style={{ fontSize: 22 }}>{track.title}</Txt>
            <Txt variant="muted" numberOfLines={1}>{track.artist} · {track.album}</Txt>
          </View>
          <IconButton
            name={track.liked ? 'heartFill' : 'heart'}
            label={track.liked ? t.player.unlike : t.common.like}
            color={track.liked ? colors.liked : colors.text}
            size={26}
            onPress={() => s.toggleLike(track)}
          />
        </View>

        <View>
          <SeekBar value={status.currentTime} max={duration} onChange={s.seek} onPreview={setPreview} label={t.player.position} />
          <View style={styles.times}>
            <Txt variant="muted">{formatTime(preview ?? status.currentTime)}</Txt>
            <Txt variant="muted">{formatTime(duration)}</Txt>
          </View>
        </View>

        <View style={styles.controls}>
          <IconButton name="shuffle" label={t.common.shuffle} active={s.queue.shuffle} onPress={s.toggleShuffle} />
          <IconButton name="prev" label={t.common.previous} size={30} onPress={s.previous} />
          <IconButton name={status.playing ? 'pause' : 'play'} label={status.playing ? t.common.pause : t.common.play} size={30} big onPress={s.togglePlay} />
          <IconButton name="next" label={t.common.next} size={30} onPress={s.next} />
          <IconButton name={repeatIcon} label={t.player.repeat[s.queue.repeat]} active={s.queue.repeat !== 'off'} onPress={s.cycleRepeat} />
        </View>

        <View style={styles.volume}>
          <Icon name="volume" size={18} color={colors.textMuted} />
          <View style={{ flex: 1 }}>
            <SeekBar value={s.volume} max={1} onChange={s.setVolume} onPreview={(v) => v != null && s.setVolume(v)} label={t.player.volume} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: layout.gutter + space.sm, justifyContent: 'space-evenly' },
  art: { width: '100%', aspectRatio: 1, maxHeight: 340, alignSelf: 'center' },
  lyrics: { flex: 1, marginVertical: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volume: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
