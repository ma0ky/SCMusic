// Format d'échange SCMusic (fichier "scmusic-share.json") et règles de partage.
// Logique pure, testée dans __tests__/export.test.ts.
import { normalize } from '@/search/search';
import type { Track, TrackLicense } from '@/db/types';
import { cleanField } from '@/library/trackInfo';
import { tr } from '@/i18n';

export const SHARE_FORMAT = 'scmusic-share';
export const SHARE_VERSION = 1;
export const MANIFEST_NAME = 'scmusic-share.json';

// Limites d'un partage reçu : un fichier piégé ne doit pas saturer la mémoire ni la base.
export const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 300 * 1024 * 1024;
const MAX_PLAYLISTS = 500;
const MAX_TRACKS_PER_PLAYLIST = 10_000;
const AUDIO_FILE = /^[^\\/\u0000-\u001f]{1,200}\.(mp3|flac)$/i;

export interface SharedTrack {
  title: string;
  artist: string;
  album: string;
  license: TrackLicense;
  /** Nom du fichier audio joint dans le dossier d'export, seulement si autorisé. */
  file?: string;
}

export interface SharedPlaylist {
  name: string;
  tracks: SharedTrack[];
}

export interface ShareManifest {
  format: typeof SHARE_FORMAT;
  version: number;
  createdAt: string;
  playlists: SharedPlaylist[];
}

/**
 * Règle légale : seuls les morceaux créés par l'utilisateur ou sous licence libre
 * peuvent être copiés vers quelqu'un d'autre. Les achats et CD numérisés restent
 * privés : seules leurs informations (titre, artiste, album) sont partagées.
 */
export function canShareAudio(license: TrackLicense): boolean {
  return license === 'own' || license === 'cc';
}

/** Nom de fichier sûr et unique dans le dossier d'export. */
export function exportFileName(track: Track): string {
  const ext = /\.[^.]+$/.exec(track.filename)?.[0] ?? '.mp3';
  const safe = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
  return `${track.id}_${safe}${ext}`;
}

export interface ExportPlan {
  manifest: ShareManifest;
  /** Fichiers à copier : morceau source → nom dans le dossier d'export. */
  audioToCopy: { track: Track; fileName: string }[];
  /** Morceaux dont l'audio n'est PAS joint (licence personnelle). */
  metadataOnly: Track[];
}

export function buildExportPlan(
  playlists: { name: string; tracks: Track[] }[],
  includeAudio: boolean,
  now = new Date(),
): ExportPlan {
  const audio = new Map<number, { track: Track; fileName: string }>();
  const metadataOnly = new Map<number, Track>();

  const shared = playlists.map((p) => ({
    name: p.name,
    tracks: p.tracks.map((t): SharedTrack => {
      const base = { title: t.title, artist: t.artist, album: t.album, license: t.license };
      if (includeAudio && canShareAudio(t.license)) {
        const fileName = exportFileName(t);
        audio.set(t.id, { track: t, fileName });
        return { ...base, file: fileName };
      }
      metadataOnly.set(t.id, t);
      return base;
    }),
  }));

  return {
    manifest: { format: SHARE_FORMAT, version: SHARE_VERSION, createdAt: now.toISOString(), playlists: shared },
    audioToCopy: [...audio.values()],
    metadataOnly: [...metadataOnly.values()],
  };
}

/** Nom de fichier audio joint acceptable : .mp3 ou .flac, sans dossier, sans "..", sans caractère de contrôle. */
export function isSafeAudioName(name: string): boolean {
  return AUDIO_FILE.test(name) && !name.includes('..');
}

/** Les premiers octets correspondent-ils bien à un MP3 (tag ID3 ou trame MPEG) ou à un FLAC ? */
export function looksLikeAudio(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  const ascii = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (ascii.startsWith('ID3') || ascii === 'fLaC') return true;
  return data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
}

/** Vérifie qu'un JSON reçu est bien un export SCMusic valide. Lève une erreur sinon. */
export function parseManifest(json: string): ShareManifest {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error(tr().errors.notJson);
  }
  const m = data as Partial<ShareManifest>;
  if (m?.format !== SHARE_FORMAT || !Array.isArray(m.playlists)) {
    throw new Error(tr().errors.notExport);
  }
  if (typeof m.version !== 'number' || m.version > SHARE_VERSION) {
    throw new Error(tr().errors.newerExport);
  }
  if (m.playlists.length > MAX_PLAYLISTS) throw new Error(tr().errors.tooManyPlaylists(MAX_PLAYLISTS));
  const licenses: TrackLicense[] = ['personal', 'own', 'cc'];
  // Les textes reçus sont nettoyés comme une saisie à la main (caractères invisibles, longueur)
  const text = (v: unknown) => cleanField(typeof v === 'string' ? v : '');
  const playlists = m.playlists.map((p) => {
    const tracks = Array.isArray(p?.tracks) ? p.tracks : [];
    if (tracks.length > MAX_TRACKS_PER_PLAYLIST) throw new Error(tr().errors.playlistTooLong(MAX_TRACKS_PER_PLAYLIST));
    return {
      name: (text(p?.name) || tr().playlists.imported).slice(0, 100),
      tracks: tracks.map((t) => ({
        title: text(t?.title),
        artist: text(t?.artist),
        album: text(t?.album),
        license: licenses.includes(t?.license) ? t.license : 'personal',
        // un fichier joint n'est accepté que si sa licence l'autorise : simple nom de fichier audio, sans chemin
        file: typeof t?.file === 'string' && canShareAudio(t.license) && isSafeAudioName(t.file) ? t.file : undefined,
      })),
    };
  });
  return { format: SHARE_FORMAT, version: m.version, createdAt: String(m.createdAt ?? ''), playlists };
}

/** Clé de correspondance entre un morceau partagé et la bibliothèque locale. */
export function matchKey(t: { title: string; artist: string }): string {
  return `${normalize(t.title)}\u0000${normalize(t.artist)}`;
}

/** Retrouve dans la bibliothèque locale les morceaux d'une playlist reçue. */
export function matchTracks(shared: SharedTrack[], library: Track[]): { found: Track[]; missing: SharedTrack[] } {
  const byKey = new Map(library.map((t) => [matchKey(t), t]));
  const found: Track[] = [];
  const missing: SharedTrack[] = [];
  for (const s of shared) {
    const hit = byKey.get(matchKey(s));
    if (hit) found.push(hit);
    else missing.push(s);
  }
  return { found, missing };
}
