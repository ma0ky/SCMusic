// Briques de base : texte monospace, carte "verre", bouton icône, bouton texte, état vide.
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { blur, colors, font, fontFamily, radius, space } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'caption';

const variantStyle = {
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  heading: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  body: { fontSize: font.md, color: colors.text },
  muted: { fontSize: font.sm, color: colors.textMuted },
  caption: { fontSize: font.xs, color: colors.textFaint, letterSpacing: 1, textTransform: 'uppercase' },
} as const;

export function Txt({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  return <Text {...props} style={[{ fontFamily }, variantStyle[variant], style]} />;
}

/** Carte effet verre : flou d'arrière-plan + voile clair + bordure fine. */
export function GlassCard({ children, style, strong }: { children: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }) {
  return (
    <View style={[styles.glass, strong && { backgroundColor: colors.glassStrong }, style]}>
      <BlurView intensity={blur.intensity} tint={blur.tint} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

export function IconButton({
  name, onPress, size = 22, color = colors.text, active, label, big,
}: {
  name: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  active?: boolean;
  label: string; // lu par les lecteurs d'écran
  big?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        big && styles.iconBtnBig,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name={name} size={size} color={active ? colors.accent : big ? colors.bg : color} />
    </Pressable>
  );
}

export function Button({ title, onPress, icon, kind = 'primary', disabled }: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const fg = kind === 'primary' ? colors.bg : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' ? { backgroundColor: colors.accent } : { backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1 },
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && <Icon name={icon} size={18} color={fg} />}
      <Txt style={{ color: fg, fontWeight: '700' }}>{title}</Txt>
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={40} color={colors.accent} />
      <Txt variant="heading" style={{ textAlign: 'center' }}>{title}</Txt>
      <Txt variant="muted" style={{ textAlign: 'center' }}>{text}</Txt>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Txt variant="caption" style={{ marginTop: space.xl, marginBottom: space.sm }}>{children}</Txt>;
}

export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--';
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  iconBtn: {
    padding: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnBig: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  empty: {
    alignItems: 'center',
    gap: space.md,
    padding: space.xxl,
  },
});
