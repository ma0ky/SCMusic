// Tokens de design SCMusic : toutes les couleurs, tailles et polices passent par ici.
// Un composant ne doit jamais écrire une couleur ou un espacement "en dur".
import { Platform } from 'react-native';

export const colors = {
  accent: '#9a9de0', // couleur principale (lavande du « [sc] » du logo)
  accentSoft: 'rgba(154, 157, 224, 0.18)',
  accentGlow: 'rgba(154, 157, 224, 0.45)',
  bg: '#06070c', // fond de l'app (fond du logo)
  bgGradientTop: '#1a1c38',
  glass: 'rgba(255, 255, 255, 0.06)', // surfaces "verre"
  glassStrong: 'rgba(255, 255, 255, 0.10)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  text: '#eceefb',
  textMuted: 'rgba(236, 238, 251, 0.6)',
  textFaint: 'rgba(236, 238, 251, 0.35)',
  danger: '#ff6b8b',
  liked: '#ff7bd5',
  overlay: 'rgba(4, 5, 10, 0.7)',
} as const;

export const radius = {
  sm: 8,
  md: 13, // rayon principal choisi pour l'identité visuelle
  lg: 20,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Police monospace système (pas de police à télécharger). */
export const fontFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 30,
} as const;

export const blur = {
  intensity: 40,
  tint: 'dark' as const,
};

export const layout = {
  miniPlayerHeight: 64,
  tabBarHeight: 60,
  rowHeight: 60,
  /** Espace à laisser en bas des listes pour ne pas passer sous le mini-lecteur et les onglets. */
  contentBottom: 180,
  gutter: 16,
} as const;
