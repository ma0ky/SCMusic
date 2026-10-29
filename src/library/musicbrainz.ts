// Recherche de l'album d'un titre sur MusicBrainz (https://musicbrainz.org) : base musicale libre, sans compte.
// Seulement quand l'utilisateur le demande ; envoyé : titre et artiste. Rien n'est appliqué sans validation.
// MusicBrainz demande au plus une requête par seconde et une application identifiée (User-Agent).
import Constants from 'expo-constants';
import type { Track } from '@/db/types';
import { netFetch, OfflineError } from '@/net/network';
import { normalize } from '@/search/search';

const SEARCH_URL = 'https://musicbrainz.org/ws/2/recording/';
/** Pause entre deux requêtes (règle d'usage de MusicBrainz : 1 par seconde). */
export const REQUEST_INTERVAL_MS = 1100;
/** MusicBrainz surchargé (503) : nouvelles tentatives après 2 s, 4 s puis 8 s. */
const RETRY_DELAYS_MS = [2000, 4000, 8000];
/** Écart de durée (s) au-delà duquel un enregistrement est sans doute une autre version. */
const DURATION_TOLERANCE = 10;

interface MbRelease {
  title: string;
  status?: string;
  date?: string;
  'release-group'?: { 'primary-type'?: string | null; 'secondary-types'?: string[] | null };
  media?: { 'track-offset'?: number }[];
}

export interface MbRecording {
  score?: number;
  title: string;
  length?: number | null; // ms
  'artist-credit'?: { name: string }[];
  releases?: MbRelease[];
}

export interface AlbumMatch {
  album: string;
  trackNo: number | null;
  year: string | null;
}

const PRIMARY_WEIGHT: Record<string, number> = { album: 4, ep: 2, single: 1 };
const SECONDARY_PENALTY: Record<string, number> = {
  compilation: 3, live: 2, remix: 2, 'dj-mix': 3, soundtrack: 1, demo: 2, mixtape: 1,
};

/** Poids d'une sortie : un album studio officiel compte bien plus qu'une compilation ou un single. */
function releaseWeight(r: MbRelease): number {
  const group = r['release-group'] ?? {};
  let w = PRIMARY_WEIGHT[(group['primary-type'] ?? '').toLowerCase()] ?? 0.5;
  for (const s of group['secondary-types'] ?? []) w -= SECONDARY_PENALTY[s.toLowerCase()] ?? 1;
  if ((r.status ?? '').toLowerCase() === 'official') w += 1;
  return Math.max(w, 0.1);
}

/**
 * Choisit l'album le plus probable parmi les réponses : chaque sortie "vote" pour son titre d'album,
 * pondérée par son type, la confiance de MusicBrainz et la durée. On garde aussi le numéro de piste
 * et l'année de la sortie la plus ancienne de cet album.
 */
export function pickAlbum(recordings: MbRecording[], track: Pick<Track, 'title' | 'artist' | 'duration'>): AlbumMatch | null {
  const artist = normalize(track.artist);
  const knownArtist = artist && artist !== normalize('Artiste inconnu');
  const votes = new Map<string, { album: string; score: number; best: MbRelease; offset: number | null }>();

  for (const rec of recordings) {
    if ((rec.score ?? 100) < 80) continue;
    const credit = normalize((rec['artist-credit'] ?? []).map((a) => a.name).join(' '));
    if (knownArtist && !credit.includes(artist) && !artist.includes(credit)) continue;
    let confidence = 1;
    if (track.duration && rec.length) {
      const gap = Math.abs(rec.length / 1000 - track.duration);
      if (gap > DURATION_TOLERANCE * 3) continue;
      if (gap <= DURATION_TOLERANCE) confidence = 1.5;
    }
    for (const rel of rec.releases ?? []) {
      if ((rel.status ?? '').toLowerCase() === 'withdrawn') continue;
      const key = normalize(rel.title);
      const w = releaseWeight(rel) * confidence;
      const offset = rel.media?.[0]?.['track-offset'];
      const vote = votes.get(key);
      if (!vote) {
        votes.set(key, { album: rel.title, score: w, best: rel, offset: offset ?? null });
      } else {
        vote.score += w;
        // On retient la sortie officielle la plus ancienne pour le numéro et l'année
        if ((rel.date ?? '9999') < (vote.best.date ?? '9999') && (rel.status ?? '').toLowerCase() === 'official') {
          vote.best = rel;
          vote.offset = offset ?? vote.offset;
        }
      }
    }
  }

  const winner = [...votes.values()].sort((a, b) => b.score - a.score)[0];
  if (!winner) return null;
  return {
    album: winner.album,
    trackNo: winner.offset != null ? winner.offset + 1 : null,
    year: winner.best.date?.slice(0, 4) || null,
  };
}

/** Échappe une valeur pour la syntaxe de recherche de MusicBrainz (Lucene). */
export function luceneQuote(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });

/** Cherche l'album d'un titre. null = rien trouvé ; lève une erreur lisible si le réseau échoue. */
export async function findAlbumOnline(
  track: Pick<Track, 'title' | 'artist' | 'duration'>,
  signal?: AbortSignal,
): Promise<AlbumMatch | null> {
  for (const delay of [...RETRY_DELAYS_MS, null]) {
    const result = await requestAlbum(track, signal);
    if (result !== 'busy') return result;
    if (delay == null || signal?.aborted) break;
    await wait(delay, signal);
  }
  if (signal?.aborted) throw new Error('Recherche arrêtée.');
  throw new Error('MusicBrainz est surchargé, réessaie dans un moment.');
}

async function requestAlbum(
  track: Pick<Track, 'title' | 'artist' | 'duration'>,
  signal?: AbortSignal,
): Promise<AlbumMatch | null | 'busy'> {
  let query = `recording:${luceneQuote(track.title)}`;
  if (track.artist && track.artist !== 'Artiste inconnu') query += ` AND artist:${luceneQuote(track.artist)}`;
  const params = new URLSearchParams({ query, fmt: 'json', limit: '10' });

  let res: Response;
  try {
    res = await netFetch(`${SEARCH_URL}?${params}`, {
      signal,
      headers: {
        'User-Agent': `SCMusic/${Constants.expoConfig?.version ?? ''} (https://github.com/ma0ky/SCMusic-releases)`,
        Accept: 'application/json',
      },
    });
  } catch (e) {
    if (e instanceof OfflineError) throw e;
    if (signal?.aborted) throw new Error('Recherche arrêtée.');
    throw new Error('Pas de connexion à Internet, ou MusicBrainz ne répond pas.');
  }
  if (res.status === 503 || res.status === 429) return 'busy';
  if (!res.ok) throw new Error(`MusicBrainz a répondu une erreur (${res.status}).`);
  const data = (await res.json()) as { recordings?: MbRecording[] };
  return pickAlbum(data.recordings ?? [], track);
}
