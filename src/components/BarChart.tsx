// Histogramme simple (une seule série) : barres fines arrondies en haut, posées sur une ligne de base.
// Toucher une barre affiche sa valeur au-dessus du graphique ; toucher à nouveau la masque.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, font, radius, space } from '@/theme/tokens';
import { Txt } from './ui';
import { useT } from '@/i18n';

interface Props {
  values: number[];
  labels: string[]; // libellé court sous chaque barre (affichés en partie si trop nombreux)
  describe: (index: number) => string; // texte de l'infobulle et du lecteur d'écran
  height?: number;
}

/** Nombre de libellés visibles sous l'axe, pour éviter qu'ils se chevauchent. */
const MAX_LABELS = 7;
const LABEL_WIDTH = 44;

export function BarChart({ values, labels, describe, height = 140 }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...values, 0);
  const every = Math.ceil(values.length / MAX_LABELS);

  return (
    <View>
      <Txt variant="muted" style={styles.tooltip} numberOfLines={1}>
        {selected != null ? describe(selected) : t.stats.tapBar}
      </Txt>
      <View style={[styles.plot, { height }]}>
        {values.map((v, i) => {
          const pct = max > 0 ? (v / max) * 100 : 0;
          const dim = selected != null && selected !== i;
          return (
            <Pressable
              key={i}
              style={styles.band}
              onPress={() => setSelected(selected === i ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={describe(i)}
            >
              {v > 0 ? <View style={[styles.bar, { height: `${Math.max(pct, 2)}%` }, dim && styles.dim]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {labels.map((l, i) =>
          i % every === 0 ? (
            <Txt key={i} style={[styles.label, { left: `${((i + 0.5) / labels.length) * 100}%` }]} numberOfLines={1}>
              {l}
            </Txt>
          ) : null,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: { marginBottom: space.sm, color: colors.text },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  // La bande entière est touchable (plus grande que la barre) ; 1 px de chaque côté = 2 px entre barres
  band: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 1 },
  bar: {
    width: '100%',
    maxWidth: 24,
    backgroundColor: colors.accent,
    borderTopLeftRadius: radius.sm / 2,
    borderTopRightRadius: radius.sm / 2,
  },
  dim: { opacity: 0.35 },
  axis: { height: 16, marginTop: space.xs },
  // Libellé centré sous sa barre, plus large que la bande pour ne pas être coupé
  label: { position: 'absolute', width: LABEL_WIDTH, marginLeft: -LABEL_WIDTH / 2, textAlign: 'center', fontSize: font.xs - 1, color: colors.textFaint },
});
