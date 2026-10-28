// Jeu d'icônes SCMusic dessinées en SVG (grille 24×24, trait arrondi).
// Aucune police d'icônes externe : tout est ici et modifiable.
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

const STROKE = {
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const shapes = {
  play: (c: string) => <Polygon points="7,4 20,12 7,20" fill={c} />,
  pause: (c: string) => (
    <>
      <Rect x={6} y={4} width={4} height={16} rx={1.5} fill={c} />
      <Rect x={14} y={4} width={4} height={16} rx={1.5} fill={c} />
    </>
  ),
  next: (c: string) => (
    <>
      <Polygon points="5,5 15,12 5,19" fill={c} />
      <Rect x={16} y={5} width={3} height={14} rx={1} fill={c} />
    </>
  ),
  prev: (c: string) => (
    <>
      <Polygon points="19,5 9,12 19,19" fill={c} />
      <Rect x={5} y={5} width={3} height={14} rx={1} fill={c} />
    </>
  ),
  shuffle: (c: string) => <Path d="M3 7h3c5 0 7 10 12 10h3M18 14l3 3-3 3M3 17h3c1.5 0 2.7-.9 3.7-2.2M13.3 9.2C14.3 7.9 15.5 7 17 7h4M18 4l3 3-3 3" stroke={c} {...STROKE} />,
  repeat: (c: string) => <Path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3" stroke={c} {...STROKE} />,
  repeatOne: (c: string) => (
    <>
      <Path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3" stroke={c} {...STROKE} />
      <Path d="M11 10.5l1.5-1v5" stroke={c} {...STROKE} strokeWidth={1.6} />
    </>
  ),
  heart: (c: string) => <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke={c} {...STROKE} />,
  heartFill: (c: string) => <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke={c} {...STROKE} fill={c} />,
  more: (c: string) => (
    <>
      <Circle cx={5} cy={12} r={1.8} fill={c} />
      <Circle cx={12} cy={12} r={1.8} fill={c} />
      <Circle cx={19} cy={12} r={1.8} fill={c} />
    </>
  ),
  search: (c: string) => <Path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20" stroke={c} {...STROKE} />,
  home: (c: string) => <Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" stroke={c} {...STROKE} />,
  library: (c: string) => <Path d="M5 4v16M10 4v16M15 5l4 14.5" stroke={c} {...STROKE} />,
  playlist: (c: string) => <Path d="M4 6h11M4 11h11M4 16h6M17 18.5a2 2 0 1 1-2-2 2 2 0 0 1 2 2zm0 0V9l3-1" stroke={c} {...STROKE} />,
  plus: (c: string) => <Path d="M12 5v14M5 12h14" stroke={c} {...STROKE} />,
  up: (c: string) => <Path d="M6 15l6-6 6 6" stroke={c} {...STROKE} />,
  down: (c: string) => <Path d="M6 9l6 6 6-6" stroke={c} {...STROKE} />,
  back: (c: string) => <Path d="M15 6l-6 6 6 6" stroke={c} {...STROKE} />,
  close: (c: string) => <Path d="M6 6l12 12M18 6L6 18" stroke={c} {...STROKE} />,
  trash: (c: string) => <Path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" stroke={c} {...STROKE} />,
  settings: (c: string) => (
    <>
      <Circle cx={12} cy={12} r={3} stroke={c} {...STROKE} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke={c} {...STROKE} />
    </>
  ),
  queue: (c: string) => <Path d="M4 6h16M4 11h16M4 16h9M16 14v6l5-3z" stroke={c} {...STROKE} />,
  folder: (c: string) => <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={c} {...STROKE} />,
  volume: (c: string) => <Path d="M4 10v4h4l5 4V6l-5 4zM16.5 8.5a5 5 0 0 1 0 7" stroke={c} {...STROKE} />,
  disc: (c: string) => (
    <>
      <Circle cx={12} cy={12} r={9} stroke={c} {...STROKE} />
      <Circle cx={12} cy={12} r={2.5} stroke={c} {...STROKE} />
    </>
  ),
  user: (c: string) => <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" stroke={c} {...STROKE} />,
  image: (c: string) => (
    <>
      <Rect x={3} y={4} width={18} height={16} rx={2.5} stroke={c} {...STROKE} />
      <Circle cx={9} cy={9.5} r={1.8} stroke={c} {...STROKE} />
      <Path d="M3.5 17l5-5 4 4 2.5-2.5 5.5 5" stroke={c} {...STROKE} />
    </>
  ),
  lyrics: (c: string) => <Path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke={c} {...STROKE} />,
  edit: (c: string) => <Path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" stroke={c} {...STROKE} />,
};

export type IconName = keyof typeof shapes;

export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shapes[name](color)}
    </Svg>
  );
}
