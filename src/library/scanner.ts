// Parcourt le dossier musique choisi par l'utilisateur et remplit la base.
// Sur Android, le dossier est choisi via le sélecteur système (accès SAF, URIs content://).
import { Directory, File, FileMode } from 'expo-file-system';
import { insertTrack, knownUris, removeTracksNotIn, getSetting, setSetting } from '@/db/queries';
import { id3TagSize, parseTags } from './tags';

const AUDIO_EXT = /\.(mp3|flac)$/i;
const MAX_TAG_BYTES = 512 * 1024; // on ne lit jamais plus que le début du fichier
const FLAC_HEAD_BYTES = 128 * 1024;
const MUSIC_DIR_KEY = 'musicDirUri';

export async function getMusicDirUri(): Promise<string | null> {
  return getSetting(MUSIC_DIR_KEY);
}

/** Ouvre le sélecteur de dossier système et mémorise le choix. */
export async function pickMusicDir(): Promise<string | null> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    await setSetting(MUSIC_DIR_KEY, dir.uri);
    return dir.uri;
  } catch {
    return null; // sélection annulée
  }
}

/** Liste récursivement les fichiers audio d'un dossier. */
function listAudioFiles(dir: Directory, out: File[] = [], depth = 0): File[] {
  if (depth > 8) return out; // garde-fou contre les arborescences trop profondes
  for (const entry of dir.list()) {
    if (entry instanceof Directory) listAudioFiles(entry, out, depth + 1);
    else if (AUDIO_EXT.test(entry.name)) out.push(entry);
  }
  return out;
}

/** Lit uniquement l'en-tête du fichier (là où se trouvent les tags). */
async function readHead(file: File): Promise<Uint8Array> {
  const handle = file.open(FileMode.ReadOnly);
  try {
    if (/\.flac$/i.test(file.name)) return await handle.readBytes(FLAC_HEAD_BYTES);
    const header = await handle.readBytes(10);
    const tagSize = Math.min(id3TagSize(header), MAX_TAG_BYTES);
    if (tagSize <= 10) return header;
    const rest = await handle.readBytes(tagSize - 10);
    const all = new Uint8Array(tagSize);
    all.set(header);
    all.set(rest, 10);
    return all;
  } finally {
    handle.close();
  }
}

export interface ScanProgress {
  done: number;
  total: number;
}

export interface ScanResult {
  added: number;
  removed: number;
  failed: number;
}

export async function scanLibrary(dirUri: string, onProgress?: (p: ScanProgress) => void): Promise<ScanResult> {
  const files = listAudioFiles(new Directory(dirUri));
  const known = await knownUris();
  const seen = new Set<string>();
  let added = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    seen.add(file.uri);
    if (!known.has(file.uri)) {
      try {
        const tags = parseTags(await readHead(file), file.name);
        await insertTrack({ uri: file.uri, filename: file.name, ...tags });
        added++;
      } catch (e) {
        console.warn('Lecture impossible :', file.name, e);
        failed++;
      }
    }
    if (i % 10 === 0 || i === files.length - 1) onProgress?.({ done: i + 1, total: files.length });
  }
  const removed = await removeTracksNotIn(seen, dirUri);
  return { added, removed, failed };
}
