// Format d'échange SCMusic (fichier "scmusic-share.json") et règles de partage.
// Logique pure, testée dans __tests__/export.test.ts.
import { normalize } from '@/search/search';
import type { Track, TrackLicense } from '@/db/types';

export const SHARE_FORMAT = 'scmusic-share';
export const SHARE_VERSION = 1;
export const MANIFEST_NAME = 'scmusic-share.json';

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

/** Vérifie qu'un JSON reçu est bien un export SCMusic valide. Lève une erreur sinon. */
export function parseManifest(json: string): ShareManifest {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Le fichier n'est pas un JSON valide.");
  }
  const m = data as Partial<ShareManifest>;
  if (m?.format !== SHARE_FORMAT || !Array.isArray(m.playlists)) {
    throw new Error("Ce fichier n'est pas un export SCMusic.");
  }
  if (typeof m.version !== 'number' || m.version > SHARE_VERSION) {
    throw new Error('Export créé par une version plus récente de SCMusic.');
  }
  const licenses: TrackLicense[] = ['personal', 'own', 'cc'];
  const playlists = m.playlists.map((p) => ({
    name: String(p?.name ?? 'Playlist importée').slice(0, 100),
    tracks: (Array.isArray(p?.tracks) ? p.tracks : []).map((t) => ({
      title: String(t?.title ?? ''),
      artist: String(t?.artist ?? ''),
      album: String(t?.album ?? ''),
      license: licenses.includes(t?.license) ? t.license : 'personal',
      // un fichier joint n'est accepté que si sa licence l'autorise, et sans chemin
      file:
        typeof t?.file === 'string' && canShareAudio(t.license) && !/[\\/]|\.\./.test(t.file) ? t.file : undefined,
    })),
  }));
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
