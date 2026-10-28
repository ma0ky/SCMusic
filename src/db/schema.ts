// Ouverture de la base SQLite locale et création des tables.
// Tout reste sur le téléphone : aucun serveur, aucun compte.
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (!db) db = openDatabaseSync('scmusic.db');
  return db;
}

// Incrémenter cette version et ajouter une étape à MIGRATIONS pour faire évoluer le schéma.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS tracks (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    uri       TEXT NOT NULL UNIQUE,
    filename  TEXT NOT NULL,
    title     TEXT NOT NULL,
    artist    TEXT NOT NULL,
    album     TEXT NOT NULL,
    track_no  INTEGER,
    duration  REAL,
    license   TEXT NOT NULL DEFAULT 'personal' CHECK (license IN ('personal', 'own', 'cc')),
    liked     INTEGER NOT NULL DEFAULT 0,
    added_at  INTEGER NOT NULL,
    last_played_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
  CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album, artist);

  CREATE TABLE IF NOT EXISTS playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id    INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, position)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // v2 : pochettes. cover_source = 'file' (nom.png à côté de nom.mp3), 'tag' (intégrée), 'folder' (cover.jpg) ou 'manual' (choisie à la main).
  // cover_checked = 1 quand le fichier a déjà été inspecté (évite de relire à chaque scan).
  `
  ALTER TABLE tracks ADD COLUMN cover_uri TEXT;
  ALTER TABLE tracks ADD COLUMN cover_source TEXT;
  ALTER TABLE tracks ADD COLUMN cover_checked INTEGER NOT NULL DEFAULT 0;
  `,
  // v3 : paroles (texte LRC ou simple), venant de nom.lrc ou des tags du fichier.
  // lyrics_checked = 1 quand les tags du fichier ont déjà été inspectés pour les paroles.
  `
  ALTER TABLE tracks ADD COLUMN lyrics TEXT;
  ALTER TABLE tracks ADD COLUMN lyrics_checked INTEGER NOT NULL DEFAULT 0;
  `,
  // v4 : statistiques. Une ligne par écoute ayant duré au moins 30 s ; listened = secondes réellement écoutées.
  `
  CREATE TABLE IF NOT EXISTS plays (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id   INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    listened   REAL NOT NULL DEFAULT 0,
    completed  INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_plays_started ON plays(started_at);
  CREATE INDEX IF NOT EXISTS idx_plays_track ON plays(track_id);
  `,
];

export async function migrate(): Promise<void> {
  const database = getDb();
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await database.withTransactionAsync(async () => {
      await database.execAsync(MIGRATIONS[version]);
    });
    version += 1;
    await database.execAsync(`PRAGMA user_version = ${version}`);
  }
}
