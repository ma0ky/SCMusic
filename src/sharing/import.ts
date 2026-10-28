// Import d'un partage SCMusic : un dossier d'export complet, ou un simple fichier JSON.
// Les fichiers audio joints sont copiés dans l'espace privé de l'app.
import { Directory, File, Paths } from 'expo-file-system';
import { addToPlaylist, allTracks, createPlaylist, insertTrack, trackByUri } from '@/db/queries';
import { MANIFEST_NAME, matchTracks, parseManifest, type ShareManifest } from './format';

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
        dest.create({ overwrite: true });
        await dest.write(await src.bytes());
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

/** Importer un dossier d'export (contenant scmusic-share.json). */
export async function importFromFolder(): Promise<ImportResult> {
  const folder = await Directory.pickDirectoryAsync();
  const manifestFile = folder.list().find((e): e is File => e instanceof File && e.name === MANIFEST_NAME);
  if (!manifestFile) throw new Error(`Aucun fichier ${MANIFEST_NAME} dans ce dossier.`);
  return applyManifest(parseManifest(await manifestFile.text()), folder);
}

/** Importer seulement des playlists reçues en JSON (aucun fichier audio). */
export async function importFromJsonFile(): Promise<ImportResult | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (picked.canceled) return null;
  return applyManifest(parseManifest(await picked.result.text()), null);
}
