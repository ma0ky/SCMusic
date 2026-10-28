// Recherche simple en mémoire : suffisante pour quelques milliers de morceaux.
// (Une recherche full-text SQLite pourra la remplacer plus tard.)
import type { Track } from '@/db/types';

/** Minuscules et sans accents : "Électro" → "electro". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Score d'un morceau pour une requête : chaque mot de la requête doit
 * apparaître dans le titre, l'artiste ou l'album. Un début de mot rapporte plus.
 * Renvoie 0 si le morceau ne correspond pas.
 */
export function scoreTrack(track: Pick<Track, 'title' | 'artist' | 'album'>, query: string): number {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const fields = [
    { text: normalize(track.title), weight: 3 },
    { text: normalize(track.artist), weight: 2 },
    { text: normalize(track.album), weight: 1 },
  ];
  let score = 0;
  for (const word of words) {
    let best = 0;
    for (const { text, weight } of fields) {
      const at = text.indexOf(word);
      if (at < 0) continue;
      const startsWord = at === 0 || text[at - 1] === ' ';
      best = Math.max(best, weight * (startsWord ? 2 : 1));
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

export interface SearchResults {
  tracks: Track[];
  artists: string[];
  albums: { album: string; artist: string }[];
}

export function search(tracks: Track[], query: string, limit = 50): SearchResults {
  const q = normalize(query);
  if (!q) return { tracks: [], artists: [], albums: [] };

  const matched = tracks
    .map((t) => ({ t, s: scoreTrack(t, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.t.title.localeCompare(b.t.title))
    .map((r) => r.t);

  const artists = new Set<string>();
  const albums = new Map<string, { album: string; artist: string }>();
  for (const t of tracks) {
    if (normalize(t.artist).includes(q)) artists.add(t.artist);
    if (normalize(t.album).includes(q)) albums.set(`${t.album}\u0000${t.artist}`, { album: t.album, artist: t.artist });
  }
  return {
    tracks: matched.slice(0, limit),
    artists: [...artists].sort().slice(0, 10),
    albums: [...albums.values()].slice(0, 10),
  };
}
