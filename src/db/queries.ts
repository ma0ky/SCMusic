// Toutes les requêtes SQL de l'application, regroupées ici.
// Les écrans n'écrivent jamais de SQL directement.
import { getDb } from './schema';
import type { AlbumSummary, ArtistSummary, Playlist, Track, TrackLicense } from './types';

interface TrackRow {
  id: number;
  uri: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  track_no: number | null;
  duration: number | null;
  license: TrackLicense;
  liked: number;
  added_at: number;
  cover_uri: string | null;
}

const toTrack = (r: TrackRow): Track => ({
  id: r.id,
  uri: r.uri,
  filename: r.filename,
  title: r.title,
  artist: r.artist,
  album: r.album,
  trackNo: r.track_no,
  duration: r.duration,
  license: r.license,
  liked: r.liked === 1,
  addedAt: r.added_at,
  coverUri: r.cover_uri,
});

// Colonnes lues pour un Track : jamais les paroles, qui peuvent peser plusieurs Ko par titre.
const TRACK_COLS = 'id, uri, filename, title, artist, album, track_no, duration, license, liked, added_at, cover_uri';
const TRACK_COLS_T = TRACK_COLS.split(', ').map((c) => `t.${c}`).join(', ');

const ORDER_BY_ALBUM = 'ORDER BY artist COLLATE NOCASE, album COLLATE NOCASE, track_no, title COLLATE NOCASE';

// ---------- Morceaux ----------

export async function allTracks(): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(`SELECT ${TRACK_COLS} FROM tracks ORDER BY title COLLATE NOCASE`);
  return rows.map(toTrack);
}

/** Morceaux par identifiant (ordre quelconque) : sert à rafraîchir la file d'attente. */
export async function tracksByIds(ids: number[]): Promise<Track[]> {
  if (!ids.length) return [];
  const rows = await getDb().getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLS} FROM tracks WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ...ids,
  );
  return rows.map(toTrack);
}

export async function knownUris(): Promise<Set<string>> {
  const rows = await getDb().getAllAsync<{ uri: string }>('SELECT uri FROM tracks');
  return new Set(rows.map((r) => r.uri));
}

export interface NewTrack {
  uri: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  trackNo?: number;
  duration?: number;
  license?: TrackLicense;
  coverUri?: string | null;
  coverSource?: CoverSource | null;
  lyrics?: string | null;
}

export type CoverSource = 'file' | 'tag' | 'folder' | 'manual';

export async function insertTrack(t: NewTrack): Promise<number> {
  const res = await getDb().runAsync(
    `INSERT INTO tracks (uri, filename, title, artist, album, track_no, duration, license, added_at, cover_uri, cover_source, cover_checked,
       lyrics, lyrics_checked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1)
     ON CONFLICT(uri) DO NOTHING`,
    t.uri, t.filename, t.title, t.artist, t.album, t.trackNo ?? null, t.duration ?? null, t.license ?? 'personal', Date.now(),
    t.coverUri ?? null, t.coverSource ?? null, t.lyrics ?? null,
  );
  return res.lastInsertRowId;
}

// ---------- Pochettes ----------

/** URIs des morceaux jamais inspectés pour leur pochette (bibliothèque scannée avant la v2). */
export async function urisWithoutCoverCheck(): Promise<Set<string>> {
  const rows = await getDb().getAllAsync<{ uri: string }>('SELECT uri FROM tracks WHERE cover_checked = 0');
  return new Set(rows.map((r) => r.uri));
}

/** Pochette trouvée au scan : ne remplace jamais une pochette choisie à la main. */
export async function setScannedCover(uri: string, coverUri: string | null, source: CoverSource | null): Promise<void> {
  await getDb().runAsync(
    `UPDATE tracks SET cover_checked = 1,
       cover_uri = CASE WHEN cover_source = 'manual' THEN cover_uri ELSE ? END,
       cover_source = CASE WHEN cover_source = 'manual' THEN cover_source ELSE ? END
     WHERE uri = ?`,
    coverUri, source, uri,
  );
}

/** Pochette choisie à la main pour un morceau (null = la retirer). */
export async function setTrackCover(id: number, coverUri: string | null): Promise<void> {
  await getDb().runAsync('UPDATE tracks SET cover_uri = ?, cover_source = ? WHERE id = ?', coverUri, coverUri ? 'manual' : null, id);
}

/** Pochette choisie à la main pour tous les titres d'un album. */
export async function setAlbumCover(album: string, coverUri: string | null): Promise<void> {
  await getDb().runAsync(
    'UPDATE tracks SET cover_uri = ?, cover_source = ? WHERE album = ? COLLATE NOCASE',
    coverUri, coverUri ? 'manual' : null, album,
  );
}

// ---------- Paroles ----------

/** URIs des morceaux dont les tags n'ont jamais été inspectés pour les paroles (scannés avant la v3). */
export async function urisWithoutLyricsCheck(): Promise<Set<string>> {
  const rows = await getDb().getAllAsync<{ uri: string }>('SELECT uri FROM tracks WHERE lyrics_checked = 0');
  return new Set(rows.map((r) => r.uri));
}

/** Paroles trouvées au scan (null = aucune). */
export async function setScannedLyrics(uri: string, lyrics: string | null): Promise<void> {
  await getDb().runAsync('UPDATE tracks SET lyrics = ?, lyrics_checked = 1 WHERE uri = ?', lyrics, uri);
}

/** Paroles trouvées en ligne ou synchronisées à la main (null = les retirer). Un scan ne les écrase que si un nom.lrc existe. */
export async function setTrackLyrics(id: number, lyrics: string | null): Promise<void> {
  await getDb().runAsync('UPDATE tracks SET lyrics = ?, lyrics_checked = 1 WHERE id = ?', lyrics, id);
}

/** Paroles d'un morceau, chargées à la demande (pas dans Track pour garder les listes légères). */
export async function trackLyrics(id: number): Promise<string | null> {
  const r = await getDb().getFirstAsync<{ lyrics: string | null }>('SELECT lyrics FROM tracks WHERE id = ?', id);
  return r?.lyrics ?? null;
}

export async function trackByUri(uri: string): Promise<Track | null> {
  const r = await getDb().getFirstAsync<TrackRow>(`SELECT ${TRACK_COLS} FROM tracks WHERE uri = ?`, uri);
  return r ? toTrack(r) : null;
}

/** Supprime les morceaux dont le fichier n'existe plus dans le dossier scanné. */
export async function removeTracksNotIn(uris: Set<string>, folderPrefix: string): Promise<number> {
  const rows = await getDb().getAllAsync<{ id: number; uri: string }>('SELECT id, uri FROM tracks');
  const gone = rows.filter((r) => r.uri.startsWith(folderPrefix) && !uris.has(r.uri));
  for (const r of gone) await getDb().runAsync('DELETE FROM tracks WHERE id = ?', r.id);
  return gone.length;
}

export async function setDuration(id: number, seconds: number): Promise<void> {
  await getDb().runAsync('UPDATE tracks SET duration = ? WHERE id = ? AND duration IS NULL', seconds, id);
}

export async function setLiked(id: number, liked: boolean): Promise<void> {
  await getDb().runAsync('UPDATE tracks SET liked = ? WHERE id = ?', liked ? 1 : 0, id);
}

export async function setLicense(id: number, license: TrackLicense): Promise<void> {
  await getDb().runAsync('UPDATE tracks SET license = ? WHERE id = ?', license, id);
}

export async function markPlayed(id: number): Promise<void> {
  await getDb().runAsync('UPDATE tracks SET last_played_at = ? WHERE id = ?', Date.now(), id);
}

export async function likedTracks(): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(`SELECT ${TRACK_COLS} FROM tracks WHERE liked = 1 ${ORDER_BY_ALBUM}`);
  return rows.map(toTrack);
}

export async function recentTracks(limit = 20): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLS} FROM tracks WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(toTrack);
}

export async function recentlyAdded(limit = 20): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(`SELECT ${TRACK_COLS} FROM tracks ORDER BY added_at DESC, id DESC LIMIT ?`, limit);
  return rows.map(toTrack);
}

// ---------- Albums et artistes ----------

export async function albums(): Promise<AlbumSummary[]> {
  return getDb().getAllAsync<AlbumSummary>(
    `SELECT album, MIN(artist) AS artist, COUNT(*) AS trackCount, MAX(cover_uri) AS coverUri
     FROM tracks GROUP BY album COLLATE NOCASE ORDER BY album COLLATE NOCASE`,
  );
}

export async function artists(): Promise<ArtistSummary[]> {
  return getDb().getAllAsync<ArtistSummary>(
    `SELECT artist, COUNT(DISTINCT album) AS albumCount, COUNT(*) AS trackCount
     FROM tracks GROUP BY artist COLLATE NOCASE ORDER BY artist COLLATE NOCASE`,
  );
}

export async function albumTracks(album: string): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLS} FROM tracks WHERE album = ? COLLATE NOCASE ORDER BY track_no, title COLLATE NOCASE`,
    album,
  );
  return rows.map(toTrack);
}

export async function artistTracks(artist: string): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLS} FROM tracks WHERE artist = ? COLLATE NOCASE ${ORDER_BY_ALBUM}`,
    artist,
  );
  return rows.map(toTrack);
}

// ---------- Playlists ----------

export async function playlists(): Promise<Playlist[]> {
  return getDb().getAllAsync<Playlist>(
    `SELECT p.id, p.name, p.created_at AS createdAt, COUNT(pt.track_id) AS trackCount
     FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     GROUP BY p.id ORDER BY p.name COLLATE NOCASE`,
  );
}

export async function playlist(id: number): Promise<Playlist | null> {
  return getDb().getFirstAsync<Playlist>(
    `SELECT p.id, p.name, p.created_at AS createdAt,
       (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) AS trackCount
     FROM playlists p WHERE p.id = ?`,
    id,
  );
}

export async function createPlaylist(name: string): Promise<number> {
  const res = await getDb().runAsync('INSERT INTO playlists (name, created_at) VALUES (?, ?)', name.trim(), Date.now());
  return res.lastInsertRowId;
}

export async function renamePlaylist(id: number, name: string): Promise<void> {
  await getDb().runAsync('UPDATE playlists SET name = ? WHERE id = ?', name.trim(), id);
}

export async function deletePlaylist(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM playlists WHERE id = ?', id);
}

export async function playlistTracks(id: number): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLS_T} FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
     WHERE pt.playlist_id = ? ORDER BY pt.position`,
    id,
  );
  return rows.map(toTrack);
}

/** Réécrit l'ordre complet d'une playlist (utilisé pour ajouter, retirer et réordonner). */
export async function setPlaylistTracks(id: number, trackIds: number[]): Promise<void> {
  const database = getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM playlist_tracks WHERE playlist_id = ?', id);
    for (let i = 0; i < trackIds.length; i++) {
      await database.runAsync('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', id, trackIds[i], i);
    }
  });
}

export async function addToPlaylist(id: number, trackIds: number[]): Promise<void> {
  const current = (await playlistTracks(id)).map((t) => t.id);
  await setPlaylistTracks(id, [...current, ...trackIds]);
}

// ---------- Statistiques d'écoute ----------

export async function insertPlay(trackId: number, startedAt: number, listened: number, completed: boolean): Promise<number> {
  const res = await getDb().runAsync(
    'INSERT INTO plays (track_id, started_at, listened, completed) VALUES (?, ?, ?, ?)',
    trackId, startedAt, listened, completed ? 1 : 0,
  );
  return res.lastInsertRowId;
}

export async function updatePlay(id: number, listened: number, completed: boolean): Promise<void> {
  await getDb().runAsync('UPDATE plays SET listened = ?, completed = ? WHERE id = ?', listened, completed ? 1 : 0, id);
}

export interface ListeningTotals {
  plays: number;
  seconds: number;
  tracks: number;
  artists: number;
  firstPlay: number | null; // ms, toutes périodes confondues
}

export async function listeningTotals(since: number): Promise<ListeningTotals> {
  const r = await getDb().getFirstAsync<Omit<ListeningTotals, 'firstPlay'>>(
    `SELECT COUNT(*) AS plays, COALESCE(SUM(p.listened), 0) AS seconds,
       COUNT(DISTINCT p.track_id) AS tracks, COUNT(DISTINCT lower(t.artist)) AS artists
     FROM plays p JOIN tracks t ON t.id = p.track_id WHERE p.started_at >= ?`,
    since,
  );
  const first = await getDb().getFirstAsync<{ first: number | null }>('SELECT MIN(started_at) AS first FROM plays');
  return { plays: r?.plays ?? 0, seconds: r?.seconds ?? 0, tracks: r?.tracks ?? 0, artists: r?.artists ?? 0, firstPlay: first?.first ?? null };
}

/** Temps écouté par jour ("2026-10-28") ou par mois ("2026-10"), en heure locale. */
export async function listeningByPeriod(since: number, unit: 'day' | 'month'): Promise<{ key: string; seconds: number }[]> {
  const format = unit === 'day' ? '%Y-%m-%d' : '%Y-%m';
  return getDb().getAllAsync<{ key: string; seconds: number }>(
    `SELECT strftime('${format}', started_at / 1000, 'unixepoch', 'localtime') AS key, SUM(listened) AS seconds
     FROM plays WHERE started_at >= ? GROUP BY key`,
    since,
  );
}

export interface TopTrack {
  track: Track;
  plays: number;
  seconds: number;
}

type TopTrackRow = TrackRow & { plays: number; seconds: number; last_play: number };

export async function topTracks(since: number, limit = 5): Promise<TopTrack[]> {
  const rows = await getDb().getAllAsync<TopTrackRow>(
    `SELECT ${TRACK_COLS_T}, COUNT(*) AS plays, SUM(p.listened) AS seconds
     FROM plays p JOIN tracks t ON t.id = p.track_id WHERE p.started_at >= ?
     GROUP BY t.id ORDER BY plays DESC, seconds DESC LIMIT ?`,
    since, limit,
  );
  return rows.map((r) => ({ track: toTrack(r), plays: r.plays, seconds: r.seconds }));
}

export interface TopGroup {
  name: string;
  artist: string;
  coverUri: string | null;
  plays: number;
  seconds: number;
}

export async function topArtists(since: number, limit = 5): Promise<TopGroup[]> {
  return getDb().getAllAsync<TopGroup>(
    `SELECT MIN(t.artist) AS name, MIN(t.artist) AS artist, MAX(t.cover_uri) AS coverUri, COUNT(*) AS plays, SUM(p.listened) AS seconds
     FROM plays p JOIN tracks t ON t.id = p.track_id WHERE p.started_at >= ?
     GROUP BY lower(t.artist) ORDER BY plays DESC, seconds DESC LIMIT ?`,
    since, limit,
  );
}

export async function topAlbums(since: number, limit = 5): Promise<TopGroup[]> {
  return getDb().getAllAsync<TopGroup>(
    `SELECT MIN(t.album) AS name, MIN(t.artist) AS artist, MAX(t.cover_uri) AS coverUri, COUNT(*) AS plays, SUM(p.listened) AS seconds
     FROM plays p JOIN tracks t ON t.id = p.track_id WHERE p.started_at >= ?
     GROUP BY lower(t.album) ORDER BY plays DESC, seconds DESC LIMIT ?`,
    since, limit,
  );
}

/** Titres souvent écoutés (3 fois ou plus) mais plus depuis `before` : à redécouvrir. */
export async function forgottenTracks(before: number, limit = 5): Promise<TopTrack[]> {
  const rows = await getDb().getAllAsync<TopTrackRow>(
    `SELECT ${TRACK_COLS_T}, COUNT(*) AS plays, SUM(p.listened) AS seconds, MAX(p.started_at) AS last_play
     FROM plays p JOIN tracks t ON t.id = p.track_id
     GROUP BY t.id HAVING plays >= 3 AND last_play < ? ORDER BY plays DESC LIMIT ?`,
    before, limit,
  );
  return rows.map((r) => ({ track: toTrack(r), plays: r.plays, seconds: r.seconds }));
}

/** Titres de la bibliothèque jamais écoutés (au moins 30 s). */
export async function neverPlayedTracks(): Promise<Track[]> {
  const rows = await getDb().getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLS} FROM tracks WHERE NOT EXISTS (SELECT 1 FROM plays WHERE plays.track_id = tracks.id) ORDER BY added_at DESC`,
  );
  return rows.map(toTrack);
}

/** Efface tout l'historique d'écoute (les titres et playlists restent). */
export async function clearPlays(): Promise<void> {
  await getDb().runAsync('DELETE FROM plays');
}

// ---------- Réglages ----------

export async function getSetting(key: string): Promise<string | null> {
  const r = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}
