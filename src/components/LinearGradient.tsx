// Dégradé vertical dessiné en SVG (évite une dépendance supplémentaire).
import Svg, { Defs, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export function LinearGradient({ from, to, style }: { from: string; to: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <SvgGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="0.6" stopColor={to} />
          </SvgGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>
    </View>
  );
}
