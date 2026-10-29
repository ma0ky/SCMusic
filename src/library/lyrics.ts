// Paroles : format LRC ("[01:23.45] texte") synchronisé, ou texte simple.
// Fonctions pures : le scanner trouve le texte, le lecteur l'affiche.

export interface LyricLine {
  time: number | null; // secondes, null si les paroles ne sont pas synchronisées
  text: string;
}

export interface Lyrics {
  synced: boolean;
  lines: LyricLine[];
}

const LRC_EXT = /\.lrc$/i;
const TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const META_TAG = /^\[(ar|ti|al|au|by|re|ve|length|offset|#):?[^\]]*\]$/i;

/** Fichier de paroles du même nom que le morceau : "nom.mp3" → "nom.lrc". */
export function pickSidecarLyrics(audioName: string, fileNames: string[]): string | null {
  const base = audioName.replace(/\.[^.]+$/, '').toLowerCase();
  return fileNames.find((n) => LRC_EXT.test(n) && n.replace(LRC_EXT, '').toLowerCase() === base) ?? null;
}

/** Au-delà, ce ne sont plus des paroles : le texte est coupé (fichier .lrc ou tag piégé, collage accidentel). */
export const MAX_LYRICS_CHARS = 100_000;

/** Nettoie le texte brut : BOM, fins de ligne Windows, blancs autour, longueur limitée. null si vide. */
export function cleanLyrics(text: string | undefined | null): string | null {
  if (!text) return null;
  const cleaned = text.slice(0, MAX_LYRICS_CHARS).replace(/^﻿/, '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Découpe des paroles LRC ou texte. Une ligne peut porter plusieurs horodatages
 * ("[00:12.00][01:30.00] refrain") ; le décalage [offset:+500] est en millisecondes.
 */
export function parseLyrics(text: string): Lyrics {
  const offsetMatch = /^\[offset:\s*([+-]?\d+)\]/im.exec(text);
  const offset = offsetMatch ? parseInt(offsetMatch[1], 10) / 1000 : 0;
  const timed: LyricLine[] = [];
  const plain: LyricLine[] = [];

  for (const raw of text.replace(/^﻿/, '').split(/\r\n?|\n/)) {
    const line = raw.trim();
    if (META_TAG.test(line)) continue;
    const times = [...line.matchAll(TIME_TAG)].map((m) => parseInt(m[1], 10) * 60 + parseFloat(m[2].replace(':', '.')));
    const words = line.replace(TIME_TAG, '').trim();
    if (times.length) {
      // Une ligne vide horodatée marque une pause (instrumental) : on la garde
      for (const t of times) timed.push({ time: Math.max(0, t - offset), text: words });
    } else {
      plain.push({ time: null, text: words });
    }
  }

  if (timed.length) return { synced: true, lines: timed.sort((a, b) => a.time! - b.time!) };
  // Texte simple : on retire les lignes vides du début et de la fin
  while (plain.length && !plain[0].text) plain.shift();
  while (plain.length && !plain[plain.length - 1].text) plain.pop();
  return { synced: false, lines: plain };
}

/** Index de la ligne en cours à la position `seconds`, ou -1 avant la première. */
export function activeLineIndex(lines: LyricLine[], seconds: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid].time ?? Infinity) <= seconds) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** 83.456 → "01:23.45" (format des horodatages LRC). */
export function formatLrcTime(seconds: number): string {
  const cs = Math.max(0, Math.round(seconds * 100));
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

/** Lignes horodatées → texte LRC. */
export function toLrc(lines: { time: number; text: string }[]): string {
  return lines.map((l) => `[${formatLrcTime(l.time)}]${l.text}`).join('\n');
}

/** Texte sans horodatages, pour repartir de paroles existantes dans l'éditeur. */
export function lyricsToPlainText(text: string): string {
  return parseLyrics(text).lines.map((l) => l.text).join('\n');
}
