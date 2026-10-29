import { MAX_LYRICS_CHARS, activeLineIndex, cleanLyrics, formatLrcTime, lyricsToPlainText, parseLyrics, pickSidecarLyrics, toLrc } from '@/library/lyrics';

test('fichier de paroles du même nom que le morceau', () => {
  const files = ['Ma Chanson.mp3', 'ma chanson.LRC', 'Autre.flac', 'cover.jpg'];
  expect(pickSidecarLyrics('Ma Chanson.mp3', files)).toBe('ma chanson.LRC');
  expect(pickSidecarLyrics('Autre.flac', files)).toBeNull();
});

test('LRC : horodatages, métadonnées ignorées, lignes multiples et tri', () => {
  const lrc = '﻿[ti:Titre]\n[ar:Artiste]\n[00:12.50]Deuxième\n[00:05.00][01:00]Refrain\n[00:20.00]\n';
  const { synced, lines } = parseLyrics(lrc);
  expect(synced).toBe(true);
  expect(lines).toEqual([
    { time: 5, text: 'Refrain' },
    { time: 12.5, text: 'Deuxième' },
    { time: 20, text: '' },
    { time: 60, text: 'Refrain' },
  ]);
});

test('LRC : décalage [offset] en millisecondes', () => {
  expect(parseLyrics('[offset:+500]\n[00:10.00]A').lines[0].time).toBe(9.5);
});

test('texte simple : non synchronisé, lignes vides des bords retirées', () => {
  const { synced, lines } = parseLyrics('\n\nCouplet 1\n\nCouplet 2\n\n');
  expect(synced).toBe(false);
  expect(lines.map((l) => l.text)).toEqual(['Couplet 1', '', 'Couplet 2']);
});

test('ligne active selon la position', () => {
  const { lines } = parseLyrics('[00:05]A\n[00:10]B\n[00:15]C');
  expect(activeLineIndex(lines, 2)).toBe(-1);
  expect(activeLineIndex(lines, 5)).toBe(0);
  expect(activeLineIndex(lines, 12)).toBe(1);
  expect(activeLineIndex(lines, 99)).toBe(2);
});

test('nettoyage du texte', () => {
  expect(cleanLyrics('﻿ a\r\nb \r\n')).toBe('a\nb');
  expect(cleanLyrics('  ')).toBeNull();
});

test('synchro au doigt : génère un LRC relisible', () => {
  expect(formatLrcTime(83.456)).toBe('01:23.46');
  const lrc = toLrc([{ time: 1.5, text: 'Un' }, { time: 62, text: 'Deux' }]);
  expect(lrc).toBe('[00:01.50]Un\n[01:02.00]Deux');
  expect(parseLyrics(lrc).lines).toEqual([{ time: 1.5, text: 'Un' }, { time: 62, text: 'Deux' }]);
  expect(lyricsToPlainText(lrc)).toBe('Un\nDeux');
});

test('paroles anormalement longues : coupées', () => {
  expect(cleanLyrics('a'.repeat(MAX_LYRICS_CHARS + 50))).toHaveLength(MAX_LYRICS_CHARS);
});
