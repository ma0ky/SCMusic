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
import { currentVersion, getAutoCheck, setAutoCheck } from '@/update/updater';
import { UpdateProgress, useUpdater } from '@/update/useUpdater';

/** Affiche un chemin SAF lisible : "content://…/tree/primary%3AMusic" → "Music". */
function readableDir(uri: string | null): string {
  if (!uri) return 'Aucun dossier choisi';
  const last = decodeURIComponent(uri).split(/[/:]/).filter(Boolean).pop();
  return last ?? uri;
}

const importSummary = (r: ImportResult) =>
  `${r.playlists} playlist(s) importée(s), ${r.tracksLinked} titre(s) retrouvé(s), ${r.audioImported} fichier(s) audio copié(s).` +
  (r.missing.length ? `\n\nAbsents de ta bibliothèque (${r.missing.length}) :\n` + r.missing.slice(0, 8).map((m) => `• ${m.artist} – ${m.title}`).join('\n') : '');

export default function Settings() {
  const insets = useSafeAreaInsets();
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const [dir, setDir] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [withAudio, setWithAudio] = useState(false);
  const { data: lists } = useLibrary(loadPlaylists, [] as Playlist[]);
  const updater = useUpdater();
  const [autoUpdate, setAutoUpdate] = useState(true);

  useEffect(() => { getMusicDirUri().then(setDir); }, []);
  useEffect(() => { getAutoCheck().then(setAutoUpdate); }, []);

  /** Exécute une action longue en affichant son état et en attrapant les erreurs. */
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) Alert.alert('Oups', msg);
    } finally {
      setBusy(null);
    }
  };

  const scan = (uri: string) =>
    run('Analyse du dossier…', async () => {
      const r = await scanLibrary(uri, (p) => setBusy(`Analyse : ${p.done} / ${p.total}`));
      libraryChanged();
      Alert.alert('Bibliothèque à jour', `${r.added} ajouté(s), ${r.removed} retiré(s), ${r.covers} pochette(s), ${r.lyrics} parole(s) trouvée(s)${r.failed ? `, ${r.failed} illisible(s)` : ''}.`);
    });

  const choose = () =>
    run('Choix du dossier…', async () => {
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
    run('Préparation…', async () => {
      const plan = await prepareExport([...selected], withAudio);
      const details =
        `${plan.manifest.playlists.length} playlist(s).\n` +
        (withAudio
          ? `${plan.audioToCopy.length} fichier(s) audio joint(s) (créations perso / licences libres).\n` +
            `${plan.metadataOnly.length} titre(s) partagé(s) sans audio (achats / CD perso, non redistribuables).`
          : 'Uniquement les infos des titres, aucun fichier audio.');
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert('Exporter ?', `${details}\n\nChoisis ensuite où créer le dossier d'export.`, [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Choisir le dossier', onPress: () => resolve(true) },
        ]),
      );
      if (!ok) return;
      const name = await exportToFolder(plan, (d, t) => setBusy(`Copie : ${d} / ${t}`));
      Alert.alert('Export terminé', `Dossier « ${name} » créé. Transmets-le (câble, clé USB, cloud…) puis importe-le dans SCMusic sur l'autre téléphone.`);
    });

  const doImport = (fromFolder: boolean) =>
    run('Import…', async () => {
      const r = fromFolder ? await importFromFolder() : await importFromJsonFile();
      if (!r) return;
      libraryChanged();
      Alert.alert('Import terminé', importSummary(r));
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Background />
      <DetailHeader title="Réglages" />
      <ScrollView contentContainerStyle={{ padding: layout.gutter, paddingBottom: insets.bottom + space.xxl }}>
        {busy && (
          <GlassCard strong style={styles.busy}>
            <Txt style={{ color: colors.accent }}>{busy}</Txt>
          </GlassCard>
        )}

        <SectionTitle>Dossier musique</SectionTitle>
        <GlassCard style={styles.card}>
          <View style={styles.dirRow}>
            <Icon name="folder" color={colors.accent} />
            <Txt numberOfLines={1} style={{ flex: 1 }}>{readableDir(dir)}</Txt>
          </View>
          <Button title={dir ? 'Changer de dossier' : 'Choisir mon dossier'} icon="folder" onPress={choose} disabled={!!busy} />
          {dir && <Button title="Rescanner" kind="ghost" onPress={() => scan(dir)} disabled={!!busy} />}
          <Txt variant="muted">Formats lus : MP3 et FLAC. Image d’un titre : mets « nom.png » (ou .jpg) à côté de « nom.mp3 », puis rescanne. Sinon : image intégrée au fichier, puis cover.jpg du dossier.</Txt>
        </GlassCard>

        <SectionTitle>Partager avec un autre utilisateur</SectionTitle>
        <GlassCard style={styles.card}>
          <Txt variant="muted">Playlists à exporter :</Txt>
          {lists.length === 0 && <Txt variant="muted">Aucune playlist pour l’instant.</Txt>}
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
              <Txt>Joindre les fichiers audio</Txt>
              <Txt variant="muted">Seulement « Ma création » et « Licence libre ». Les achats et CD restent privés : seules leurs infos partent.</Txt>
            </View>
            <Switch value={withAudio} onValueChange={setWithAudio} trackColor={{ true: colors.accent, false: colors.glassStrong }} thumbColor={colors.text} />
          </View>
          <Button title="Exporter dans un dossier" icon="folder" onPress={doExport} disabled={!!busy || selected.size === 0} />
          <Button title="Envoyer les playlists (JSON)" kind="ghost" icon="playlist" onPress={() => run('Partage…', () => sharePlaylistsJson([...selected]))} disabled={!!busy || selected.size === 0} />
        </GlassCard>

        <SectionTitle>Recevoir un partage</SectionTitle>
        <GlassCard style={styles.card}>
          <Button title="Importer un dossier d’export" icon="folder" onPress={() => doImport(true)} disabled={!!busy} />
          <Button title="Importer un fichier JSON" kind="ghost" icon="playlist" onPress={() => doImport(false)} disabled={!!busy} />
          <Txt variant="muted">Les titres d’une playlist reçue sont retrouvés dans ta bibliothèque par titre et artiste.</Txt>
        </GlassCard>

        <SectionTitle>Mises à jour</SectionTitle>
        <GlassCard style={styles.card}>
          <Txt>Version installée : {currentVersion()}</Txt>
          <Button title="Vérifier les mises à jour" icon="down" onPress={() => run('Vérification…', () => updater.check(true))} disabled={!!busy || updater.progress != null} />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Txt>Vérifier à l’ouverture</Txt>
              <Txt variant="muted">Au plus une fois par jour, une requête à GitHub (dépôt public SCMusic-releases). Aucune donnée personnelle envoyée.</Txt>
            </View>
            <Switch
              value={autoUpdate}
              onValueChange={(on) => { setAutoUpdate(on); setAutoCheck(on); }}
              trackColor={{ true: colors.accent, false: colors.glassStrong }}
              thumbColor={colors.text}
            />
          </View>
        </GlassCard>

        <SectionTitle>À propos</SectionTitle>
        <Txt variant="muted">SCMusic, logiciel libre sous licence GPL-3.0. Tes fichiers et ta bibliothèque ne quittent jamais ton téléphone. Seules connexions : la recherche de paroles quand tu la demandes, et la vérification des mises à jour.</Txt>
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
