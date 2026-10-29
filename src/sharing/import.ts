// Import d'un partage SCMusic : un dossier d'export complet, ou un simple fichier JSON.
// Les fichiers audio joints sont copiés dans l'espace privé de l'app.
import { Directory, File, Paths } from 'expo-file-system';
import { addToPlaylist, allTracks, createPlaylist, insertTrack, trackByUri } from '@/db/queries';
import { looksLikeAudio, MANIFEST_NAME, MAX_AUDIO_BYTES, MAX_MANIFEST_BYTES, matchTracks, parseManifest, type ShareManifest } from './format';

export interface ImportResult {
  playlists: number;
  tracksLinked: number;
  audioImported: number;
  missing: { title: string; artist: string }[];
}

function importedDir(): Directory {
  const dir = new Directory(Paths.document, 'imported');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function applyManifest(manifest: ShareManifest, folder: Directory | null): Promise<ImportResult> {
  let audioImported = 0;

  // 1. Copier les fichiers audio joints (uniquement ceux autorisés, déjà filtrés par parseManifest)
  if (folder) {
    const files = new Map(
      folder.list().filter((e): e is File => e instanceof File).map((f) => [f.name, f]),
    );
    const target = importedDir();
    for (const p of manifest.playlists) {
      for (const t of p.tracks) {
        const src = t.file ? files.get(t.file) : undefined;
        if (!src) continue;
        const dest = new File(target, t.file!);
        if (await trackByUri(dest.uri)) continue; // déjà importé
        if (src.size > MAX_AUDIO_BYTES) continue; // fichier anormalement gros : ignoré
        const data = await src.bytes();
        if (!looksLikeAudio(data)) continue; // l'extension ment : ce n'est pas un MP3 / FLAC
        dest.create({ overwrite: true });
        await dest.write(data);
        await insertTrack({ uri: dest.uri, filename: t.file!, title: t.title, artist: t.artist, album: t.album, license: t.license });
        audioImported++;
      }
    }
  }

  // 2. Recréer les playlists à partir des morceaux présents dans la bibliothèque
  const library = await allTracks();
  let tracksLinked = 0;
  const missing: ImportResult['missing'] = [];
  for (const p of manifest.playlists) {
    const { found, missing: lost } = matchTracks(p.tracks, library);
    const id = await createPlaylist(p.name);
    await addToPlaylist(id, found.map((t) => t.id));
    tracksLinked += found.length;
    missing.push(...lost.map((t) => ({ title: t.title, artist: t.artist })));
  }
  return { playlists: manifest.playlists.length, tracksLinked, audioImported, missing };
}

/** Lit le fichier de partage après avoir vérifié sa taille. */
async function readManifest(file: File): Promise<ShareManifest> {
  if (file.size > MAX_MANIFEST_BYTES) throw new Error('Fichier de partage trop volumineux (5 Mo maximum).');
  return parseManifest(await file.text());
}

/** Importer un dossier d'export (contenant scmusic-share.json). */
export async function importFromFolder(): Promise<ImportResult> {
  const folder = await Directory.pickDirectoryAsync();
  const manifestFile = folder.list().find((e): e is File => e instanceof File && e.name === MANIFEST_NAME);
  if (!manifestFile) throw new Error(`Aucun fichier ${MANIFEST_NAME} dans ce dossier.`);
  return applyManifest(await readManifest(manifestFile), folder);
}

/** Importer seulement des playlists reçues en JSON (aucun fichier audio). */
export async function importFromJsonFile(): Promise<ImportResult | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (picked.canceled) return null;
  return applyManifest(await readManifest(picked.result), null);
}
