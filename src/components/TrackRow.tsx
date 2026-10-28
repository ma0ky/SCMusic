// Ligne d'un morceau dans une liste. Appui = lecture, bouton "…" = menu d'actions.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Track } from '@/db/types';
import { useCurrentTrack } from '@/store/usePlayerStore';
import { colors, layout, radius, space } from '@/theme/tokens';
import { Cover } from './Cover';
import { Icon } from './Icon';
import { formatTime, IconButton, Txt } from './ui';

export function TrackRow({
  track, onPress, onMore, right, subtitle,
}: {
  track: Track;
  onPress: () => void;
  onMore?: () => void;
  right?: ReactNode; // boutons supplémentaires (ex. monter/descendre dans une playlist)
  subtitle?: string;
}) {
  const playing = useCurrentTrack();
  const isCurrent = playing?.id === track.id;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.glass }]}
      accessibilityLabel={`${track.title}, ${track.artist}`}
    >
      <Cover uri={track.coverUri} size={44} highlight={isCurrent} />
      <View style={styles.text}>
        <Txt numberOfLines={1} style={isCurrent && { color: colors.accent }}>{track.title}</Txt>
        <Txt variant="muted" numberOfLines={1}>
          {subtitle ?? `${track.artist} · ${formatTime(track.duration)}`}
        </Txt>
      </View>
      {track.liked && <Icon name="heartFill" size={14} color={colors.liked} />}
      {right}
      {onMore && <IconButton name="more" label="Actions" onPress={onMore} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: 2 },
});
