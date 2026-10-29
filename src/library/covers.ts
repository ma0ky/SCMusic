// Pochettes : stockées dans l'espace privé de l'app (file://), ce qui permet aussi
// de les afficher sur l'écran verrouillé et dans la notification de lecture.
import { Directory, File, Paths } from 'expo-file-system';
import { sniffImageMime, type EmbeddedPicture } from './tags';

/** Noms d'images de dossier reconnus (comparaison sans majuscules). */
export const FOLDER_COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart'];
const IMAGE_EXT = /\.(jpe?g|png)$/i;
/** Limites d'une pochette : au-delà, l'image est refusée (fichier piégé, "pixel flood"). */
export const MAX_COVER_BYTES = 15 * 1024 * 1024;
export const MAX_COVER_PIXELS = 50_000_000; // ~7000 × 7000

/** Empreinte FNV-1a des octets : deux titres d'un même album partagent le même fichier. */
export function fingerprint(data: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}${data.length.toString(16)}`;
}

/**
 * Image portant le même nom que le morceau : "nom.mp3" → "nom.png" ou "nom.jpg".
 * C'est la façon la plus simple d'associer une image à un titre précis.
 */
export function pickSidecarCover(audioName: string, fileNames: string[]): string | null {
  const base = audioName.replace(/\.[^.]+$/, '').toLowerCase();
  return fileNames.find((n) => IMAGE_EXT.test(n) && n.replace(IMAGE_EXT, '').toLowerCase() === base) ?? null;
}

/** Choisit l'image de pochette d'un dossier parmi ses fichiers (cover.jpg, folder.png…). */
export function pickFolderCover(fileNames: string[]): string | null {
  const images = fileNames.filter((n) => IMAGE_EXT.test(n));
  for (const wanted of FOLDER_COVER_NAMES) {
    const hit = images.find((n) => n.replace(IMAGE_EXT, '').toLowerCase() === wanted);
    if (hit) return hit;
  }
  return null;
}

function coversDir(): Directory {
  const dir = new Directory(Paths.document, 'covers');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Largeur et hauteur lues dans l'en-tête PNG (IHDR) ou JPEG (marqueur SOF), sans décoder l'image. */
export function imageSize(data: Uint8Array): { width: number; height: number } | null {
  if (data[0] === 0x89 && data[1] === 0x50 && data.length >= 24) {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    let pos = 2;
    while (pos + 9 < data.length) {
      if (data[pos] !== 0xff) return null;
      const marker = data[pos + 1];
      if (marker === 0xff) { pos++; continue; } // octet de remplissage
      const length = (data[pos + 2] << 8) | data[pos + 3];
      // SOF0 à SOF15, sauf DHT (C4), JPG (C8) et DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (data[pos + 5] << 8) | data[pos + 6], width: (data[pos + 7] << 8) | data[pos + 8] };
      }
      if (length < 2) return null;
      pos += 2 + length;
    }
  }
  return null;
}

/** Lève une erreur si l'image est trop lourde ou trop grande pour être affichée sans risque. */
export function checkCover(data: Uint8Array): void {
  if (data.length > MAX_COVER_BYTES) throw new Error('Image trop lourde (15 Mo maximum).');
  const size = imageSize(data);
  if (!size || size.width <= 0 || size.height <= 0) throw new Error("Ce fichier n'est pas une image JPEG ou PNG valide.");
  if (size.width * size.height > MAX_COVER_PIXELS) throw new Error('Image trop grande (environ 7000 × 7000 pixels maximum).');
}

/** Enregistre une image et renvoie son URI file://. Ne réécrit pas une image déjà connue. */
export async function saveCover(picture: EmbeddedPicture): Promise<string> {
  checkCover(picture.data);
  const ext = picture.mime === 'image/png' ? 'png' : 'jpg';
  const file = new File(coversDir(), `${fingerprint(picture.data)}.${ext}`);
  if (!file.exists) {
    file.create({ overwrite: true });
    await file.write(picture.data);
  }
  return file.uri;
}

/** Copie une image du téléphone (sélecteur ou dossier musique) vers les pochettes. */
export async function saveCoverFromFile(source: File): Promise<string> {
  if (source.size > MAX_COVER_BYTES) throw new Error('Image trop lourde (15 Mo maximum).');
  const data = await source.bytes();
  return saveCover({ mime: sniffImageMime(data, source.name), data });
}

/** Ouvre le sélecteur d'images. Renvoie l'URI de la pochette enregistrée, ou null si annulé. */
export async function pickCoverImage(): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['image/jpeg', 'image/png'] });
  if (picked.canceled) return null;
  return saveCoverFromFile(picked.result);
}
