// Parcourt le dossier musique choisi par l'utilisateur et remplit la base.
// Sur Android, le dossier est choisi via le sélecteur système (accès SAF, URIs content://).
import { Directory, File, FileMode } from 'expo-file-system';
import {
  getSetting, insertTrack, knownUris, removeTracksNotIn, setScannedCover, setSetting, urisWithoutCoverCheck,
  type CoverSource,
} from '@/db/queries';
import { pickFolderCover, saveCover, saveCoverFromFile } from './covers';
import { id3TagSize, parseTags } from './tags';

const AUDIO_EXT = /\.(mp3|flac)$/i;
const MAX_TAG_BYTES = 8 * 1024 * 1024; // un tag ID3 avec pochette dépasse rarement quelques Mo
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

interface AudioEntry {
  file: File;
  folderCover: File | null; // cover.jpg / folder.png… du même dossier
}

/** Liste récursivement les fichiers audio, avec l'image de pochette de leur dossier. */
function listAudioFiles(dir: Directory, out: AudioEntry[] = [], depth = 0): AudioEntry[] {
  if (depth > 8) return out; // garde-fou contre les arborescences trop profondes
  const entries = dir.list();
  const files = entries.filter((e): e is File => e instanceof File);
  const coverName = pickFolderCover(files.map((f) => f.name));
  const folderCover = coverName ? files.find((f) => f.name === coverName) ?? null : null;
  for (const entry of entries) {
    if (entry instanceof Directory) listAudioFiles(entry, out, depth + 1);
    else if (AUDIO_EXT.test(entry.name)) out.push({ file: entry, folderCover });
  }
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Lit uniquement les métadonnées du fichier (tags + pochette), jamais l'audio. */
async function readMetadata(file: File): Promise<Uint8Array> {
  const handle = file.open(FileMode.ReadOnly);
  try {
    if (/\.flac$/i.test(file.name)) {
      // On parcourt les blocs de métadonnées FLAC un par un jusqu'au dernier
      const parts = [await handle.readBytes(4)]; // "fLaC"
      for (let i = 0; i < 64; i++) {
        const header = await handle.readBytes(4);
        if (header.length < 4) break;
        const len = (header[1] << 16) | (header[2] << 8) | header[3];
        parts.push(header, await handle.readBytes(len));
        if (header[0] & 0x80) break; // dernier bloc
      }
      return concatBytes(parts);
    }
    const header = await handle.readBytes(10);
    const tagSize = Math.min(id3TagSize(header), MAX_TAG_BYTES);
    if (tagSize <= 10) return header;
    return concatBytes([header, await handle.readBytes(tagSize - 10)]);
  } finally {
    handle.close();
  }
}

/** Pochette d'un morceau : celle intégrée au fichier, sinon l'image du dossier. */
async function findCover(
  picture: ReturnType<typeof parseTags>['picture'],
  folderCover: File | null,
  folderCache: Map<string, string>,
): Promise<{ uri: string | null; source: CoverSource | null }> {
  if (picture) return { uri: await saveCover(picture), source: 'tag' };
  if (folderCover) {
    let uri = folderCache.get(folderCover.uri);
    if (!uri) {
      uri = await saveCoverFromFile(folderCover);
      folderCache.set(folderCover.uri, uri);
    }
    return { uri, source: 'folder' };
  }
  return { uri: null, source: null };
}

export interface ScanProgress {
  done: number;
  total: number;
}

export interface ScanResult {
  added: number;
  removed: number;
  failed: number;
  covers: number; // morceaux pour lesquels une pochette a été trouvée
}

export async function scanLibrary(dirUri: string, onProgress?: (p: ScanProgress) => void): Promise<ScanResult> {
  const entries = listAudioFiles(new Directory(dirUri));
  const known = await knownUris();
  const needCover = await urisWithoutCoverCheck();
  const folderCache = new Map<string, string>();
  const seen = new Set<string>();
  let added = 0;
  let failed = 0;
  let covers = 0;

  for (let i = 0; i < entries.length; i++) {
    const { file, folderCover } = entries[i];
    seen.add(file.uri);
    const isNew = !known.has(file.uri);
    if (isNew || needCover.has(file.uri)) {
      try {
        const { picture, ...tags } = parseTags(await readMetadata(file), file.name);
        const cover = await findCover(picture, folderCover, folderCache);
        if (cover.uri) covers++;
        if (isNew) {
          await insertTrack({ uri: file.uri, filename: file.name, ...tags, coverUri: cover.uri, coverSource: cover.source });
          added++;
        } else {
          await setScannedCover(file.uri, cover.uri, cover.source);
        }
      } catch (e) {
        console.warn('Lecture impossible :', file.name, e);
        failed++;
      }
    }
    if (i % 10 === 0 || i === entries.length - 1) onProgress?.({ done: i + 1, total: entries.length });
  }
  const removed = await removeTracksNotIn(seen, dirUri);
  return { added, removed, failed, covers };
}
