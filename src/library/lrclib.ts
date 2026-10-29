// Recherche de paroles sur LRCLIB (https://lrclib.net) : base libre, gratuite, sans compte.
// Uniquement quand l'utilisateur appuie sur "Chercher en ligne" ; envoyé : titre et artiste du morceau.
// Une recherche sans résultat est gardée en mémoire pour ne pas redemander la même chose.
import Constants from 'expo-constants';
import { lyricsNotFoundAt, saveLyricsNotFound } from '@/db/queries';
import type { Track } from '@/db/types';
import { netFetch, OfflineError } from '@/net/network';

const SEARCH_URL = 'https://lrclib.net/api/search';
/** Écart de durée toléré entre le fichier et le résultat (versions radio, live…). */
const DURATION_TOLERANCE = 8;

export interface LrclibResult {
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration?: number | null;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export interface FoundLyrics {
  text: string;
  synced: boolean;
  source: string; // "Artiste – Titre" du résultat retenu, pour l'afficher
}

/**
 * Choisit le meilleur résultat : d'abord des paroles synchronisées à la bonne durée,
 * puis des paroles simples à la bonne durée, puis n'importe quelles paroles synchronisées.
 */
export function pickBestMatch(results: LrclibResult[], duration: number | null): LrclibResult | null {
  const withLyrics = results.filter((r) => !r.instrumental && (r.syncedLyrics?.trim() || r.plainLyrics?.trim()));
  const gap = (r: LrclibResult) => (duration && r.duration ? Math.abs(r.duration - duration) : 0);
  const close = withLyrics.filter((r) => gap(r) <= DURATION_TOLERANCE).sort((a, b) => gap(a) - gap(b));
  return (
    close.find((r) => r.syncedLyrics?.trim()) ??
    close[0] ??
    withLyrics.find((r) => r.syncedLyrics?.trim()) ??
    null
  );
}

/** 1730000000000 → "27/10/2026" (date d'une recherche passée). */
export function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export type LyricsSearch =
  | { kind: 'found'; lyrics: FoundLyrics }
  | { kind: 'none' } // rien sur LRCLIB (gardé en mémoire)
  | { kind: 'already'; at: number }; // déjà cherché sans résultat : pas de nouvelle requête

/**
 * Cherche les paroles d'un morceau. Un titre déjà cherché sans résultat n'est pas redemandé
 * (sauf `force`, ou si son titre / artiste a changé). Lève une erreur lisible si le réseau échoue.
 */
export async function searchLyricsOnline(
  track: Pick<Track, 'id' | 'title' | 'artist' | 'duration'>,
  force = false,
): Promise<LyricsSearch> {
  if (!force) {
    const at = await lyricsNotFoundAt(track);
    if (at != null) return { kind: 'already', at };
  }
  const params = new URLSearchParams({ track_name: track.title });
  if (track.artist && track.artist !== 'Artiste inconnu') params.set('artist_name', track.artist);

  let res: Response;
  try {
    // LRCLIB demande d'identifier l'application qui l'interroge
    res = await netFetch(`${SEARCH_URL}?${params}`, {
      headers: { 'User-Agent': `SCMusic ${Constants.expoConfig?.version ?? ''} (https://github.com/ma0ky/SCMusic)` },
    });
  } catch (e) {
    if (e instanceof OfflineError) throw e;
    throw new Error('Pas de connexion à Internet, ou LRCLIB ne répond pas.');
  }
  if (res.status === 503 || res.status === 429) throw new Error('LRCLIB est surchargé, réessaie dans un moment.');
  if (!res.ok) throw new Error(`LRCLIB a répondu une erreur (${res.status}).`);

  const best = pickBestMatch((await res.json()) as LrclibResult[], track.duration);
  if (!best) {
    await saveLyricsNotFound(track);
    return { kind: 'none' };
  }
  const synced = !!best.syncedLyrics?.trim();
  return {
    kind: 'found',
    lyrics: { text: (synced ? best.syncedLyrics : best.plainLyrics)!.trim(), synced, source: `${best.artistName} – ${best.trackName}` },
  };
}
