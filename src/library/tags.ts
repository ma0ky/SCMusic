// Lecture des tags d'un fichier audio (ID3v2 pour le MP3, Vorbis Comment pour le FLAC).
// Fonctions pures sur des octets : le scanner lit le début du fichier et nous le passe.
// On ne lit que des métadonnées texte, jamais d'image.

export interface ParsedTags {
  title?: string;
  artist?: string;
  album?: string;
  trackNo?: number;
  duration?: number; // secondes (connue pour le FLAC grâce au bloc STREAMINFO)
}

/** Nettoie une valeur de tag : caractères nuls, espaces multiples, valeurs vides. */
export function cleanTag(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/** "3/12" → 3, "07" → 7, valeur invalide → undefined. */
export function parseTrackNo(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value.split('/')[0], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Devine titre et artiste depuis le nom de fichier ("01 - Artiste - Titre.mp3"). */
export function tagsFromFilename(filename: string): ParsedTags {
  const base = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  const parts = base.split(' - ').map((p) => p.trim()).filter(Boolean);
  let trackNo: number | undefined;
  if (parts.length > 1 && /^\d{1,3}$/.test(parts[0])) trackNo = parseInt(parts.shift()!, 10);
  if (parts.length >= 2) {
    return { artist: cleanTag(parts[0]), title: cleanTag(parts.slice(1).join(' - ')), trackNo };
  }
  const numbered = /^(\d{1,3})[.\s-]+(.+)$/.exec(parts[0] ?? base);
  if (numbered) return { trackNo: parseInt(numbered[1], 10), title: cleanTag(numbered[2]) };
  return { title: cleanTag(parts[0] ?? base), trackNo };
}

// ---------- Décodage de texte ----------

function decodeLatin1(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

function decodeUtf16(bytes: Uint8Array, bigEndian: boolean): string {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    s += String.fromCharCode(bigEndian ? (bytes[i] << 8) | bytes[i + 1] : bytes[i] | (bytes[i + 1] << 8));
  }
  return s;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/** Décode un frame texte ID3 : le 1er octet indique l'encodage. */
function decodeId3Text(data: Uint8Array): string {
  const encoding = data[0];
  const body = data.subarray(1);
  switch (encoding) {
    case 1: {
      // UTF-16 avec BOM (FF FE = little endian, FE FF = big endian)
      if (body[0] === 0xfe && body[1] === 0xff) return decodeUtf16(body.subarray(2), true);
      if (body[0] === 0xff && body[1] === 0xfe) return decodeUtf16(body.subarray(2), false);
      return decodeUtf16(body, false);
    }
    case 2:
      return decodeUtf16(body, true);
    case 3:
      return decodeUtf8(body);
    default:
      return decodeLatin1(body);
  }
}

// ---------- ID3v2 (MP3) ----------

function synchsafe(b: Uint8Array, at: number): number {
  return (b[at] << 21) | (b[at + 1] << 14) | (b[at + 2] << 7) | b[at + 3];
}

function uint32(b: Uint8Array, at: number): number {
  return ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
}

/** Taille totale du tag ID3v2 (en-tête compris), ou 0 si absent. Utile pour savoir combien lire. */
export function id3TagSize(header: Uint8Array): number {
  if (header.length < 10 || decodeLatin1(header.subarray(0, 3)) !== 'ID3') return 0;
  return 10 + synchsafe(header, 6);
}

const ID3_FRAMES: Record<string, keyof ParsedTags> = {
  TIT2: 'title', TPE1: 'artist', TALB: 'album', TRCK: 'trackNo', // v2.3 / v2.4
  TT2: 'title', TP1: 'artist', TAL: 'album', TRK: 'trackNo', // v2.2
};

export function parseId3(bytes: Uint8Array): ParsedTags {
  const total = id3TagSize(bytes);
  if (total === 0) return {};
  const version = bytes[3]; // 2, 3 ou 4
  const idLen = version === 2 ? 3 : 4;
  const headerLen = version === 2 ? 6 : 10;
  const end = Math.min(total, bytes.length);
  const raw: Record<string, string> = {};

  let pos = 10;
  if (version >= 3 && bytes[5] & 0x40) {
    // en-tête étendu à sauter
    pos += version === 4 ? synchsafe(bytes, 10) : uint32(bytes, 10) + 4;
  }
  while (pos + headerLen <= end) {
    const id = decodeLatin1(bytes.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break; // padding atteint
    const size =
      version === 2
        ? (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5]
        : version === 4
          ? synchsafe(bytes, pos + 4)
          : uint32(bytes, pos + 4);
    const dataStart = pos + headerLen;
    if (size <= 0 || dataStart + size > end) break;
    const key = ID3_FRAMES[id];
    if (key && !(key in raw)) raw[key] = decodeId3Text(bytes.subarray(dataStart, dataStart + size));
    pos = dataStart + size;
  }
  return {
    title: cleanTag(raw.title),
    artist: cleanTag(raw.artist),
    album: cleanTag(raw.album),
    trackNo: parseTrackNo(cleanTag(raw.trackNo)),
  };
}

// ---------- FLAC ----------

function uint32le(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

export function parseFlac(bytes: Uint8Array): ParsedTags {
  if (decodeLatin1(bytes.subarray(0, 4)) !== 'fLaC') return {};
  const result: ParsedTags = {};
  let pos = 4;
  let last = false;
  while (!last && pos + 4 <= bytes.length) {
    last = (bytes[pos] & 0x80) !== 0;
    const type = bytes[pos] & 0x7f;
    const len = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    const start = pos + 4;
    if (start + len > bytes.length) break;
    const block = bytes.subarray(start, start + len);

    if (type === 0 && len >= 18) {
      // STREAMINFO : fréquence (20 bits) et nombre total d'échantillons (36 bits)
      const sampleRate = (block[10] << 12) | (block[11] << 4) | (block[12] >> 4);
      const samples = (block[13] & 0x0f) * 2 ** 32 + uint32(block, 14);
      if (sampleRate > 0 && samples > 0) result.duration = Math.round(samples / sampleRate);
    } else if (type === 4) {
      // VORBIS_COMMENT : longueurs en little endian, entrées "CLE=valeur"
      let p = 0;
      p += 4 + uint32le(block, p); // chaîne "vendor"
      const count = uint32le(block, p);
      p += 4;
      for (let i = 0; i < count && p + 4 <= block.length; i++) {
        const l = uint32le(block, p);
        p += 4;
        const entry = decodeUtf8(block.subarray(p, p + l));
        p += l;
        const eq = entry.indexOf('=');
        if (eq < 0) continue;
        const k = entry.slice(0, eq).toUpperCase();
        const v = entry.slice(eq + 1);
        if (k === 'TITLE') result.title ??= cleanTag(v);
        else if (k === 'ARTIST') result.artist ??= cleanTag(v);
        else if (k === 'ALBUM') result.album ??= cleanTag(v);
        else if (k === 'TRACKNUMBER') result.trackNo ??= parseTrackNo(v);
      }
    }
    pos = start + len;
  }
  return result;
}

/** Combine tags du fichier et repli sur le nom de fichier. */
export function parseTags(bytes: Uint8Array, filename: string): Required<Pick<ParsedTags, 'title' | 'artist' | 'album'>> & ParsedTags {
  const fromFile = filename.toLowerCase().endsWith('.flac') ? parseFlac(bytes) : parseId3(bytes);
  const fromName = tagsFromFilename(filename);
  return {
    title: fromFile.title ?? fromName.title ?? filename,
    artist: fromFile.artist ?? fromName.artist ?? 'Artiste inconnu',
    album: fromFile.album ?? 'Album inconnu',
    trackNo: fromFile.trackNo ?? fromName.trackNo,
    duration: fromFile.duration,
  };
}
