// Pochettes : stockées dans l'espace privé de l'app (file://), ce qui permet aussi
// de les afficher sur l'écran verrouillé et dans la notification de lecture.
import { Directory, File, Paths } from 'expo-file-system';
import { sniffImageMime, type EmbeddedPicture } from './tags';

/** Noms d'images de dossier reconnus (comparaison sans majuscules). */
export const FOLDER_COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart'];
const IMAGE_EXT = /\.(jpe?g|png)$/i;

/** Empreinte FNV-1a des octets : deux titres d'un même album partagent le même fichier. */
export function fingerprint(data: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}${data.length.toString(16)}`;
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

/** Enregistre une image et renvoie son URI file://. Ne réécrit pas une image déjà connue. */
export async function saveCover(picture: EmbeddedPicture): Promise<string> {
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
  const data = await source.bytes();
  return saveCover({ mime: sniffImageMime(data, source.name), data });
}

/** Ouvre le sélecteur d'images. Renvoie l'URI de la pochette enregistrée, ou null si annulé. */
export async function pickCoverImage(): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['image/jpeg', 'image/png'] });
  if (picked.canceled) return null;
  return saveCoverFromFile(picked.result);
}
