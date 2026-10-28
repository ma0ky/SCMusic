// Types partagés par la base de données, le lecteur et les écrans.

/**
 * Origine légale d'un morceau. Elle décide si le fichier audio peut être
 * exporté vers un autre utilisateur :
 * - personal : acheté ou numérisé pour soi → jamais exporté (seulement ses infos)
 * - own      : création personnelle → exportable
 * - cc       : licence libre (Creative Commons…) → exportable
 */
export type TrackLicense = 'personal' | 'own' | 'cc';

export interface Track {
  id: number;
  uri: string; // emplacement du fichier (content:// sur Android)
  filename: string;
  title: string;
  artist: string;
  album: string;
  trackNo: number | null;
  duration: number | null; // en secondes, connue après lecture si absente des tags
  license: TrackLicense;
  liked: boolean;
  addedAt: number;
  /** Pochette (file://), ou null. */
  coverUri: string | null;
  /** Titre, artiste, album ou numéro modifiés à la main dans l'app (le fichier, lui, n'est pas modifié). */
  edited: boolean;
}

export interface Playlist {
  id: number;
  name: string;
  createdAt: number;
  trackCount: number;
}

export interface AlbumSummary {
  album: string;
  artist: string;
  trackCount: number;
  coverUri: string | null;
}

export interface ArtistSummary {
  artist: string;
  albumCount: number;
  trackCount: number;
}
