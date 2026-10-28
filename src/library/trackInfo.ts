// Validation des infos saisies à la main (logique pure, testée).
// Ces textes ne servent qu'à l'affichage et aux requêtes paramétrées : jamais à construire un chemin
// de fichier, une URL ou du code. On les nettoie quand même pour qu'ils restent affichables et sûrs.
import type { TrackInfoPatch } from '@/db/queries';

export const MAX_FIELD_LENGTH = 200;
const MAX_TRACK_NO = 999;

// Caractères de contrôle (dont retours à la ligne et octet nul) et caractères de direction Unicode
// (U+202A–U+202E, U+2066–U+2069), qui permettent d'afficher un texte trompeur ("RTLO").
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Nettoie un champ : caractères invisibles retirés, espaces regroupés, longueur limitée. */
export function cleanField(value: string): string {
  return value.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD_LENGTH).trim();
}

export interface TrackInfoForm {
  title: string;
  artist: string;
  album: string;
  trackNo: string;
}

export type FormResult = { ok: true; patch: TrackInfoPatch } | { ok: false; error: string };

/**
 * Formulaire → modifications. Pour un seul titre, chaque champ est appliqué (titre obligatoire,
 * artiste / album vides = inconnu). Pour plusieurs titres, un champ laissé vide ne change rien.
 */
export function formToPatch(form: TrackInfoForm, multiple: boolean): FormResult {
  const title = cleanField(form.title);
  const artist = cleanField(form.artist);
  const album = cleanField(form.album);
  const no = form.trackNo.trim();

  let trackNo: number | null | undefined;
  if (no === '') trackNo = multiple ? undefined : null;
  else if (/^\d{1,3}$/.test(no) && Number(no) >= 1 && Number(no) <= MAX_TRACK_NO) trackNo = Number(no);
  else return { ok: false, error: `Le numéro de piste doit être un nombre entre 1 et ${MAX_TRACK_NO}.` };

  if (multiple) {
    const patch: TrackInfoPatch = {};
    if (artist) patch.artist = artist;
    if (album) patch.album = album;
    if (trackNo !== undefined) patch.trackNo = trackNo;
    if (!Object.keys(patch).length) return { ok: false, error: 'Remplis au moins un champ à appliquer aux titres choisis.' };
    return { ok: true, patch };
  }
  if (!title) return { ok: false, error: 'Le titre ne peut pas être vide.' };
  return { ok: true, patch: { title, artist: artist || 'Artiste inconnu', album: album || 'Album inconnu', trackNo } };
}

/** Paramètre de route "12,5,7" → identifiants valides, sans doublon (le reste est ignoré). */
export function parseIds(param: string | string[] | undefined, max = 5000): number[] {
  const raw = Array.isArray(param) ? param.join(',') : param ?? '';
  const ids = raw.split(',').filter((s) => /^\d{1,10}$/.test(s)).map(Number).filter((n) => n > 0);
  return [...new Set(ids)].slice(0, max);
}

/** Valeur commune à tous les titres, ou '' si elles diffèrent (pour préremplir une édition groupée). */
export function commonValue(values: string[]): string {
  return values.length && values.every((v) => v === values[0]) ? values[0] : '';
}
