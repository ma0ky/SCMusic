// Recherche de paroles sur LRCLIB (https://lrclib.net) : base libre, gratuite, sans compte.
// Seul accès Internet de l'app, et uniquement quand l'utilisateur appuie sur "Chercher en ligne".
// Envoyé : titre et artiste du morceau. Rien d'autre (ni compte, ni identifiant d'appareil).
import Constants from 'expo-constants';
import type { Track } from '@/db/types';

const SEARCH_URL = 'https://lrclib.net/api/search';
const TIMEOUT_MS = 15000;
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

/** Cherche les paroles d'un morceau. null = rien trouvé ; lève une erreur lisible si le réseau échoue. */
export async function searchLyricsOnline(track: Pick<Track, 'title' | 'artist' | 'duration'>): Promise<FoundLyrics | null> {
  const params = new URLSearchParams({ track_name: track.title });
  if (track.artist && track.artist !== 'Artiste inconnu') params.set('artist_name', track.artist);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${SEARCH_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        // LRCLIB demande d'identifier l'application qui l'interroge
        'User-Agent': `SCMusic ${Constants.expoConfig?.version ?? ''} (https://github.com/ma0ky/SCMusic)`,
        // Une seule requête : la connexion est fermée dès la réponse reçue, au lieu de rester ouverte en réserve
        Connection: 'close',
      },
    });
  } catch {
    throw new Error('Pas de connexion à Internet, ou LRCLIB ne répond pas.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 503 || res.status === 429) throw new Error('LRCLIB est surchargé, réessaie dans un moment.');
  if (!res.ok) throw new Error(`LRCLIB a répondu une erreur (${res.status}).`);

  const best = pickBestMatch((await res.json()) as LrclibResult[], track.duration);
  if (!best) return null;
  const synced = !!best.syncedLyrics?.trim();
  return {
    text: (synced ? best.syncedLyrics : best.plainLyrics)!.trim(),
    synced,
    source: `${best.artistName} – ${best.trackName}`,
  };
}
