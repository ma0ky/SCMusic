// Réglages : dossier musique + scan, export / import pour partager avec un autre utilisateur, mises à jour.
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Background } from '@/components/Screen';
import { Button, GlassCard, SectionTitle, Txt } from '@/components/ui';
import { playlists as loadPlaylists } from '@/db/queries';
import type { Playlist } from '@/db/types';
import { getMusicDirUri, pickMusicDir, scanLibrary } from '@/library/scanner';
import { exportToFolder, prepareExport, sharePlaylistsJson } from '@/sharing/export';
import { importFromFolder, importFromJsonFile, type ImportResult } from '@/sharing/import';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, layout, radius, space } from '@/theme/tokens';
import { isOfflineMode, setOfflineMode } from '@/net/network';
import { currentVersion, getAutoCheck, getWifiOnly, setAutoCheck, setWifiOnly } from '@/update/updater';
import { UpdateProgress, useUpdater } from '@/update/useUpdater';
import { LANGS, tr, useLang, useT } from '@/i18n';
import { saveLanguage } from '@/i18n/storage';

/** Affiche un chemin SAF lisible : "content://…/tree/primary%3AMusic" → "Music". */
function readableDir(uri: string | null): string | null {
  if (!uri) return null;
  const last = decodeURIComponent(uri).split(/[/:]/).filter(Boolean).pop();
  return last ?? uri;
}

const importSummary = (r: ImportResult) =>
  tr().settings.importSummary(r) +
  (r.missing.length ? tr().settings.missing(r.missing.length) + r.missing.slice(0, 8).map((m) => `• ${m.artist} – ${m.title}`).join('\n') : '');

export default function Settings() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const [dir, setDir] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [withAudio, setWithAudio] = useState(false);
  const { data: lists } = useLibrary(loadPlaylists, [] as Playlist[]);
  const updater = useUpdater();
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [wifiOnly, setWifiOnlyState] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => { getMusicDirUri().then(setDir); }, []);
  useEffect(() => {
    getAutoCheck().then(setAutoUpdate);
    getWifiOnly().then(setWifiOnlyState);
    isOfflineMode().then(setOffline);
  }, []);

  /** Exécute une action longue en affichant son état et en attrapant les erreurs. */
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) Alert.alert(t.common.oops, msg);
    } finally {
      setBusy(null);
    }
  };

  const scan = (uri: string) =>
    run(t.settings.scanning, async () => {
      const r = await scanLibrary(uri, (p) => setBusy(t.settings.scanProgress(p.done, p.total)));
      libraryChanged();
      Alert.alert(t.settings.libraryUpdated, t.settings.scanResult(r));
    });

  const choose = () =>
    run(t.settings.choosing, async () => {
      const uri = await pickMusicDir();
      if (!uri) return;
      setDir(uri);
      await scan(uri);
    });

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const doExport = () =>
    run(t.settings.preparing, async () => {
      const plan = await prepareExport([...selected], withAudio);
      const details =
        t.settings.exportPlaylists(plan.manifest.playlists.length) +
        (withAudio ? t.settings.exportAudio(plan.audioToCopy.length, plan.metadataOnly.length) : t.settings.exportInfoOnly);
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert(t.settings.exportConfirm, t.settings.exportThen(details), [
          { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
          { text: t.settings.pickFolder, onPress: () => resolve(true) },
        ]),
      );
      if (!ok) return;
      const name = await exportToFolder(plan, (d, total) => setBusy(t.settings.copying(d, total)));
      Alert.alert(t.settings.exportDone, t.settings.exportDoneText(name));
    });

  const doImport = (fromFolder: boolean) =>
    run(t.settings.importing, async () => {
      const r = fromFolder ? await importFromFolder() : await importFromJsonFile();
      if (!r) return;
      libraryChanged();
      Alert.alert(t.settings.importDone, importSummary(r));
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Background />
      <DetailHeader title={t.settings.title} />
      <ScrollView contentContainerStyle={{ padding: layout.gutter, paddingBottom: insets.bottom + space.xxl }}>
        {busy && (
          <GlassCard strong style={styles.busy}>
            <Txt style={{ color: colors.accent }}>{busy}</Txt>
          </GlassCard>
        )}

        <SectionTitle>{t.settings.language}</SectionTitle>
        <GlassCard style={styles.card}>
          {LANGS.map((l) => {
            const on = l.value === lang;
            return (
              <Pressable key={l.value} onPress={() => saveLanguage(l.value)} style={styles.check} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <View style={[styles.box, styles.radio, on && { backgroundColor: colors.accent, borderColor: colors.accent }]} />
                <Txt style={{ flex: 1 }}>{l.label}</Txt>
              </Pressable>
            );
          })}
        </GlassCard>

        <SectionTitle>{t.settings.musicFolder}</SectionTitle>
        <GlassCard style={styles.card}>
          <View style={styles.dirRow}>
            <Icon name="folder" color={colors.accent} />
            <Txt numberOfLines={1} style={{ flex: 1 }}>{readableDir(dir) ?? t.settings.noFolder}</Txt>
          </View>
          <Button title={dir ? t.settings.changeFolder : t.settings.chooseFolder} icon="folder" onPress={choose} disabled={!!busy} />
          {dir && <Button title={t.settings.rescan} kind="ghost" onPress={() => scan(dir)} disabled={!!busy} />}
          <Txt variant="muted">{t.settings.formats}</Txt>
        </GlassCard>

        <SectionTitle>{t.settings.share}</SectionTitle>
        <GlassCard style={styles.card}>
          <Txt variant="muted">{t.settings.toExport}</Txt>
          {lists.length === 0 && <Txt variant="muted">{t.settings.noPlaylist}</Txt>}
          {lists.map((p) => {
            const on = selected.has(p.id);
            return (
              <Pressable key={p.id} onPress={() => toggle(p.id)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={[styles.box, on && { backgroundColor: colors.accent, borderColor: colors.accent }]} />
                <Txt numberOfLines={1} style={{ flex: 1 }}>{p.name}</Txt>
                <Txt variant="muted">{p.trackCount}</Txt>
              </Pressable>
            );
          })}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Txt>{t.settings.withAudio}</Txt>
              <Txt variant="muted">{t.settings.withAudioNote}</Txt>
            </View>
            <Switch value={withAudio} onValueChange={setWithAudio} trackColor={{ true: colors.accent, false: colors.glassStrong }} thumbColor={colors.text} />
          </View>
          <Button title={t.settings.exportFolder} icon="folder" onPress={doExport} disabled={!!busy || selected.size === 0} />
          <Button title={t.settings.sendJson} kind="ghost" icon="playlist" onPress={() => run(t.settings.sharing, () => sharePlaylistsJson([...selected]))} disabled={!!busy || selected.size === 0} />
        </GlassCard>

        <SectionTitle>{t.settings.receive}</SectionTitle>
        <GlassCard style={styles.card}>
          <Button title={t.settings.importFolder} icon="folder" onPress={() => doImport(true)} disabled={!!busy} />
          <Button title={t.settings.importJson} kind="ghost" icon="playlist" onPress={() => doImport(false)} disabled={!!busy} />
          <Txt variant="muted">{t.settings.importNote}</Txt>
        </GlassCard>

        <SectionTitle>{t.settings.network}</SectionTitle>
        <GlassCard style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Txt>{t.settings.offline}</Txt>
              <Txt variant="muted">{t.settings.offlineNote}</Txt>
            </View>
            <Switch
              value={offline}
              onValueChange={(on) => { setOffline(on); setOfflineMode(on); }}
              trackColor={{ true: colors.accent, false: colors.glassStrong }}
              thumbColor={colors.text}
            />
          </View>
        </GlassCard>

        <SectionTitle>{t.settings.updates}</SectionTitle>
        <GlassCard style={styles.card}>
          <Txt>{t.settings.installed(currentVersion())}</Txt>
          <Button title={t.settings.checkUpdates} icon="down" onPress={() => run(t.settings.checking, () => updater.check(true))} disabled={!!busy || updater.progress != null || offline} />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Txt>{t.settings.checkOnOpen}</Txt>
              <Txt variant="muted">{t.settings.checkOnOpenNote}</Txt>
            </View>
            <Switch
              value={autoUpdate}
              onValueChange={(on) => { setAutoUpdate(on); setAutoCheck(on); }}
              trackColor={{ true: colors.accent, false: colors.glassStrong }}
              thumbColor={colors.text}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Txt>{t.settings.wifiOnly}</Txt>
              <Txt variant="muted">{t.settings.wifiOnlyNote}</Txt>
            </View>
            <Switch
              value={wifiOnly}
              disabled={!autoUpdate}
              onValueChange={(on) => { setWifiOnlyState(on); setWifiOnly(on); }}
              trackColor={{ true: colors.accent, false: colors.glassStrong }}
              thumbColor={colors.text}
            />
          </View>
        </GlassCard>

        <SectionTitle>{t.settings.about}</SectionTitle>
        <Txt variant="muted">{t.settings.aboutText}</Txt>
      </ScrollView>
      <UpdateProgress progress={updater.progress} />
    </View>
  );
}

const styles = StyleSheet.create({
  busy: { padding: space.md, marginBottom: space.sm },
  card: { padding: space.lg, gap: space.md },
  dirRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  box: { width: 20, height: 20, borderRadius: radius.sm / 2, borderWidth: 2, borderColor: colors.textMuted },
  radio: { borderRadius: radius.pill },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
