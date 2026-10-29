// Dialogue de mise à jour : propose la nouvelle version, affiche le téléchargement.
// Utilisé au démarrage (silencieux si rien de neuf) et depuis les réglages.
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { GlassCard, Txt } from '@/components/ui';
import { colors, layout, radius, space } from '@/theme/tokens';
import { checkForUpdate, currentVersion, downloadAndInstall, skipVersion, type UpdateInfo } from './updater';
import { useT } from '@/i18n';

export function useUpdater() {
  const t = useT();
  const [progress, setProgress] = useState<number | null>(null);

  const install = async (info: UpdateInfo) => {
    setProgress(0);
    try {
      await downloadAndInstall(info, setProgress);
    } catch (e) {
      Alert.alert(t.update.failed, e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const offer = (info: UpdateInfo) =>
    Alert.alert(
      t.update.available(info.version),
      t.update.offer(currentVersion(), info.notes, t.update.megabytes((info.size / 1024 / 1024).toFixed(1))),
      [
        { text: t.update.skip, style: 'destructive', onPress: () => skipVersion(info.version) },
        { text: t.common.later, style: 'cancel' },
        { text: t.update.install, onPress: () => install(info) },
      ],
    );

  /** `manual` : vérification demandée depuis les réglages, on répond même s'il n'y a rien. */
  const check = async (manual = false) => {
    try {
      const info = await checkForUpdate(manual);
      if (info) offer(info);
      else if (manual) Alert.alert(t.update.upToDate, t.update.upToDateText(currentVersion()));
    } catch (e) {
      if (manual) Alert.alert(t.update.checkFailed, e instanceof Error ? e.message : String(e));
    }
  };

  return { check, progress };
}

/** Bandeau de progression du téléchargement, posé au-dessus de l'écran. */
export function UpdateProgress({ progress }: { progress: number | null }) {
  const t = useT();
  if (progress == null) return null;
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return (
    <View style={styles.wrap} pointerEvents="none">
      <GlassCard strong style={styles.card}>
        <Txt>{t.update.downloading(pct)}</Txt>
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
