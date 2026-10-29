// File d'attente : voir, sauter à un titre, réorganiser, retirer.
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/Header';
import { Background } from '@/components/Screen';
import { TrackRow } from '@/components/TrackRow';
import { EmptyState, IconButton } from '@/components/ui';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, space } from '@/theme/tokens';
import { useT } from '@/i18n';

export default function Queue() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { queue, jumpTo, moveInQueue, removeFromQueue } = usePlayerStore();
  const n = queue.order.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Background />
      <DetailHeader title={t.queue.title} subtitle={t.queue.subtitle(n, queue.shuffle)} icon="down" />
      <FlatList
        data={queue.order}
        keyExtractor={(e) => String(e.uid)}
        initialScrollIndex={queue.index > 2 ? queue.index - 2 : undefined}
        getItemLayout={(_, i) => ({ length: 60, offset: 60 * i, index: i })}
        contentContainerStyle={{ paddingHorizontal: space.sm, paddingBottom: insets.bottom + space.xl }}
        ListEmptyComponent={<EmptyState icon="queue" title={t.queue.empty} text={t.queue.emptyText} />}
        renderItem={({ item, index }) => (
          <View style={{ opacity: index < queue.index ? 0.45 : 1 }}>
            <TrackRow
              track={item.item}
              onPress={() => jumpTo(index)}
              right={
                <View style={{ flexDirection: 'row' }}>
                  <IconButton name="up" label={t.common.moveUp} onPress={() => moveInQueue(index, index - 1)} color={index === 0 ? colors.textFaint : colors.text} />
                  <IconButton name="down" label={t.common.moveDown} onPress={() => moveInQueue(index, index + 1)} color={index === n - 1 ? colors.textFaint : colors.text} />
                  <IconButton name="close" label={t.common.remove} onPress={() => removeFromQueue(index)} color={colors.textMuted} />
                </View>
              }
            />
          </View>
        )}
      />
    </View>
  );
}
