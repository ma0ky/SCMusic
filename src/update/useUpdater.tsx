// Dialogue de mise à jour : propose la nouvelle version, affiche le téléchargement.
// Utilisé au démarrage (silencieux si rien de neuf) et depuis les réglages.
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { GlassCard, Txt } from '@/components/ui';
import { colors, layout, radius, space } from '@/theme/tokens';
import { checkForUpdate, currentVersion, downloadAndInstall, skipVersion, type UpdateInfo } from './updater';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

export function useUpdater() {
  const [progress, setProgress] = useState<number | null>(null);

  const install = async (info: UpdateInfo) => {
    setProgress(0);
    try {
      await downloadAndInstall(info, setProgress);
    } catch (e) {
      Alert.alert('Mise à jour impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const offer = (info: UpdateInfo) =>
    Alert.alert(
      `SCMusic ${info.version} disponible`,
      `Tu as la version ${currentVersion()}.${info.notes ? `\n\n${info.notes}` : ''}\n\nTéléchargement : ${megabytes(info.size)}. Android te demandera de confirmer l'installation ; tes titres et playlists sont gardés.`,
      [
        { text: 'Ignorer cette version', style: 'destructive', onPress: () => skipVersion(info.version) },
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Mettre à jour', onPress: () => install(info) },
      ],
    );

  /** `manual` : vérification demandée depuis les réglages, on répond même s'il n'y a rien. */
  const check = async (manual = false) => {
    try {
      const info = await checkForUpdate(manual);
      if (info) offer(info);
      else if (manual) Alert.alert('À jour', `Tu as la dernière version (${currentVersion()}).`);
    } catch (e) {
      if (manual) Alert.alert('Vérification impossible', e instanceof Error ? e.message : String(e));
    }
  };

  return { check, progress };
}

/** Bandeau de progression du téléchargement, posé au-dessus de l'écran. */
export function UpdateProgress({ progress }: { progress: number | null }) {
  if (progress == null) return null;
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return (
    <View style={styles.wrap} pointerEvents="none">
      <GlassCard strong style={styles.card}>
        <Txt>Téléchargement de la mise à jour… {pct} %</Txt>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: layout.gutter, right: layout.gutter, top: 56 },
  card: { padding: space.lg, gap: space.md },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.glassStrong, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
});
