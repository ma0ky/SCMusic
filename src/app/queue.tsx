// File d'attente : voir, sauter à un titre, réorganiser, retirer.
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/Header';
import { Background } from '@/components/Screen';
import { TrackRow } from '@/components/TrackRow';
import { EmptyState, IconButton } from '@/components/ui';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, space } from '@/theme/tokens';

export default function Queue() {
  const insets = useSafeAreaInsets();
  const { queue, jumpTo, moveInQueue, removeFromQueue } = usePlayerStore();
  const n = queue.order.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Background />
      <DetailHeader title="File d'attente" subtitle={`${n} titre${n > 1 ? 's' : ''}${queue.shuffle ? ' · aléatoire' : ''}`} icon="down" />
      <FlatList
        data={queue.order}
        keyExtractor={(e) => String(e.uid)}
        initialScrollIndex={queue.index > 2 ? queue.index - 2 : undefined}
        getItemLayout={(_, i) => ({ length: 60, offset: 60 * i, index: i })}
        contentContainerStyle={{ paddingHorizontal: space.sm, paddingBottom: insets.bottom + space.xl }}
        ListEmptyComponent={<EmptyState icon="queue" title="File vide" text="Lance un morceau pour remplir la file." />}
        renderItem={({ item, index }) => (
          <View style={{ opacity: index < queue.index ? 0.45 : 1 }}>
            <TrackRow
              track={item.item}
              onPress={() => jumpTo(index)}
              right={
                <View style={{ flexDirection: 'row' }}>
                  <IconButton name="up" label="Monter" onPress={() => moveInQueue(index, index - 1)} color={index === 0 ? colors.textFaint : colors.text} />
                  <IconButton name="down" label="Descendre" onPress={() => moveInQueue(index, index + 1)} color={index === n - 1 ? colors.textFaint : colors.text} />
                  <IconButton name="close" label="Retirer" onPress={() => removeFromQueue(index)} color={colors.textMuted} />
                </View>
              }
            />
          </View>
        )}
      />
    </View>
  );
}
