// Export : écrit un dossier de partage (scmusic-share.json + fichiers audio autorisés)
// ou partage seulement les playlists (fichier JSON) via les apps du téléphone.
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { playlistTracks, playlists as allPlaylists } from '@/db/queries';
import { buildExportPlan, MANIFEST_NAME, type ExportPlan } from './format';

async function collect(playlistIds: number[]) {
  const list = (await allPlaylists()).filter((p) => playlistIds.includes(p.id));
  return Promise.all(list.map(async (p) => ({ name: p.name, tracks: await playlistTracks(p.id) })));
}

/** Prépare l'export sans rien écrire : permet d'afficher un résumé avant de confirmer. */
export async function prepareExport(playlistIds: number[], includeAudio: boolean): Promise<ExportPlan> {
  return buildExportPlan(await collect(playlistIds), includeAudio);
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const mimeOf = (name: string) => (/\.flac$/i.test(name) ? 'audio/flac' : 'audio/mpeg');

/**
 * Écrit l'export dans un dossier choisi par l'utilisateur (carte SD, Téléchargements…).
 * Le dossier créé peut ensuite être transmis (câble, clé USB, cloud) puis importé.
 */
export async function exportToFolder(plan: ExportPlan, onProgress?: (done: number, total: number) => void): Promise<string> {
  const parent = await Directory.pickDirectoryAsync();
  const folder = parent.createDirectory(`SCMusic-export-${stamp()}`);

  const manifest = folder.createFile(MANIFEST_NAME, 'application/json');
  await manifest.write(JSON.stringify(plan.manifest, null, 2));

  const total = plan.audioToCopy.length;
  for (let i = 0; i < total; i++) {
    const { track, fileName } = plan.audioToCopy[i];
    const dest = folder.createFile(fileName, mimeOf(fileName));
    await dest.write(await new File(track.uri).bytes());
    onProgress?.(i + 1, total);
  }
  return folder.name;
}

/** Partage uniquement les playlists (infos des morceaux, aucun fichier audio). */
export async function sharePlaylistsJson(playlistIds: number[]): Promise<void> {
  const plan = buildExportPlan(await collect(playlistIds), false);
  const file = new File(Paths.cache, `scmusic-playlists-${stamp()}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(plan.manifest, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Partager mes playlists' });
}
