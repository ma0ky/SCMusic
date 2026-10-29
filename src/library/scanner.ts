// Parcourt le dossier musique choisi par l'utilisateur et remplit la base.
// Sur Android, le dossier est choisi via le sélecteur système (accès SAF, URIs content://).
import { Directory, File, FileMode } from 'expo-file-system';
import {
  getSetting, insertTrack, knownUris, removeTracksNotIn, setScannedCover, setScannedLyrics, setSetting, urisWithoutCoverCheck,
  urisWithoutLyricsCheck, type CoverSource,
} from '@/db/queries';
import { pickFolderCover, pickSidecarCover, saveCover, saveCoverFromFile } from './covers';
import { cleanLyrics, pickSidecarLyrics } from './lyrics';
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
  sidecar: File | null; // nom.png à côté de nom.mp3
  lrc: File | null; // nom.lrc à côté de nom.mp3
  folderCover: File | null; // cover.jpg / folder.png… du même dossier
}

/** Liste récursivement les fichiers audio, avec l'image de pochette de leur dossier. */
function listAudioFiles(dir: Directory, out: AudioEntry[] = [], depth = 0): AudioEntry[] {
  if (depth > 8) return out; // garde-fou contre les arborescences trop profondes
  const entries = dir.list();
  const files = entries.filter((e): e is File => e instanceof File);
  const names = files.map((f) => f.name);
  const byName = (name: string | null) => (name ? files.find((f) => f.name === name) ?? null : null);
  const folderCover = byName(pickFolderCover(names));
  for (const entry of entries) {
    if (entry instanceof Directory) listAudioFiles(entry, out, depth + 1);
    else if (AUDIO_EXT.test(entry.name)) out.push({
      file: entry,
      sidecar: byName(pickSidecarCover(entry.name, names)),
      lrc: byName(pickSidecarLyrics(entry.name, names)),
      folderCover,
    });
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

/**
 * Pochette d'un morceau, par ordre de priorité :
 * image du même nom (nom.png), image intégrée au fichier, image du dossier (cover.jpg).
 */
async function findCover(
  sidecar: File | null,
  picture: ReturnType<typeof parseTags>['picture'],
  folderCover: File | null,
  folderCache: Map<string, string>,
): Promise<{ uri: string | null; source: CoverSource | null }> {
  // Une image refusée (trop grande, illisible) n'empêche pas d'ajouter le morceau : on passe à la suivante
  const attempt = async (name: string, save: () => Promise<string>): Promise<string | null> => {
    try {
      return await save();
    } catch (e) {
      console.warn('Image ignorée :', name, e instanceof Error ? e.message : e);
      return null;
    }
  };
  const fromSidecar = sidecar && (await attempt(sidecar.name, () => saveCoverFromFile(sidecar)));
  if (fromSidecar) return { uri: fromSidecar, source: 'file' };
  const fromTag = picture && (await attempt('image intégrée', () => saveCover(picture)));
  if (fromTag) return { uri: fromTag, source: 'tag' };
  if (folderCover) {
    let uri = folderCache.get(folderCover.uri) ?? null;
    if (!uri) {
      uri = await attempt(folderCover.name, () => saveCoverFromFile(folderCover));
      if (uri) folderCache.set(folderCover.uri, uri);
    }
    if (uri) return { uri, source: 'folder' };
  }
  return { uri: null, source: null };
}

/** Paroles d'un morceau : fichier nom.lrc en priorité, sinon celles intégrées aux tags. */
async function findLyrics(lrc: File | null, fromTags: string | undefined): Promise<string | null> {
  // Un .lrc de plus de 1 Mo n'est pas un fichier de paroles : ignoré
  if (lrc && lrc.size <= 1024 * 1024) {
    try {
      const text = cleanLyrics(await lrc.text());
      if (text) return text;
    } catch (e) {
      console.warn('Paroles illisibles :', lrc.name, e);
    }
  }
  return cleanLyrics(fromTags);
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
  lyrics: number; // morceaux pour lesquels des paroles ont été trouvées
}

export async function scanLibrary(dirUri: string, onProgress?: (p: ScanProgress) => void): Promise<ScanResult> {
  const entries = listAudioFiles(new Directory(dirUri));
  const known = await knownUris();
  const needCover = await urisWithoutCoverCheck();
  const needLyrics = await urisWithoutLyricsCheck();
  const folderCache = new Map<string, string>();
  const seen = new Set<string>();
  let added = 0;
  let failed = 0;
  let covers = 0;
  let lyricsFound = 0;

  for (let i = 0; i < entries.length; i++) {
    const { file, sidecar, lrc, folderCover } = entries[i];
    seen.add(file.uri);
    const isNew = !known.has(file.uri);
    const coverToCheck = isNew || needCover.has(file.uri);
    const lyricsToCheck = isNew || needLyrics.has(file.uri);
    if (coverToCheck || lyricsToCheck) {
      try {
        const { picture, lyrics: tagLyrics, ...tags } = parseTags(await readMetadata(file), file.name);
        const lyrics = await findLyrics(lrc, tagLyrics);
        if (lyrics) lyricsFound++;
        if (coverToCheck) {
          const cover = await findCover(sidecar, picture, folderCover, folderCache);
          if (cover.uri) covers++;
          if (isNew) {
            await insertTrack({ uri: file.uri, filename: file.name, ...tags, coverUri: cover.uri, coverSource: cover.source, lyrics });
            added++;
          } else {
            await setScannedCover(file.uri, cover.uri, cover.source);
          }
        }
        if (!isNew) await setScannedLyrics(file.uri, lyrics);
      } catch (e) {
        console.warn('Lecture impossible :', file.name, e);
        failed++;
      }
    }
    if (!isNew) {
      // Morceau déjà connu : une image nom.png ou des paroles nom.lrc ajoutées depuis le dernier scan sont prises en compte
      if (sidecar && !coverToCheck) {
        try {
          await setScannedCover(file.uri, await saveCoverFromFile(sidecar), 'file');
          covers++;
        } catch (e) {
          console.warn('Image illisible :', sidecar.name, e);
        }
      }
      if (lrc && !lyricsToCheck) {
        const lyrics = await findLyrics(lrc, undefined);
        if (lyrics) {
          await setScannedLyrics(file.uri, lyrics);
          lyricsFound++;
        }
      }
    }
    if (i % 10 === 0 || i === entries.length - 1) onProgress?.({ done: i + 1, total: entries.length });
  }
  const removed = await removeTracksNotIn(seen, dirUri);
  return { added, removed, failed, covers, lyrics: lyricsFound };
}
