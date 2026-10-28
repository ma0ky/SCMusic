// Barre glissable réutilisée pour la position du morceau et le volume.
// Pendant le glissement, on affiche la valeur visée sans attendre le lecteur.
import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { colors, radius } from '@/theme/tokens';

interface Props {
  value: number;
  max: number;
  onChange: (v: number) => void; // appelé au relâchement
  onPreview?: (v: number | null) => void; // valeur en cours de glissement (null à la fin)
  label: string;
}

export function SeekBar({ value, max, onChange, onPreview, label }: Props) {
  const width = useRef(1);
  const [dragging, setDragging] = useState<number | null>(null);

  // Gestes gérés directement par le système de "responder" de React Native
  const valueAt = (x: number) => Math.min(Math.max(x / width.current, 0), 1) * max;
  const move = (e: GestureResponderEvent) => {
    const v = valueAt(e.nativeEvent.locationX);
    setDragging(v);
    onPreview?.(v);
  };
  const end = () => {
    setDragging(null);
    onPreview?.(null);
  };

  const shown = dragging ?? value;
  const pct = max > 0 ? Math.min(shown / max, 1) * 100 : 0;

  return (
    <View
      style={styles.hit}
      onLayout={(e: LayoutChangeEvent) => (width.current = Math.max(e.nativeEvent.layout.width, 1))}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={move}
      onResponderMove={move}
      onResponderRelease={(e) => {
        onChange(valueAt(e.nativeEvent.locationX));
        end();
      }}
      onResponderTerminate={end}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={[styles.thumb, { left: `${pct}%` }, dragging != null && styles.thumbActive]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.glassStrong, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  thumbActive: { width: 20, height: 20, marginLeft: -10, backgroundColor: colors.accent },
});
