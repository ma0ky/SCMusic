import { pickBestMatch, type LrclibResult } from '@/library/lrclib';

const r = (over: Partial<LrclibResult>): LrclibResult => ({ trackName: 'T', artistName: 'A', duration: 200, ...over });

test('préfère des paroles synchronisées à la bonne durée', () => {
  const results = [
    r({ duration: 200, plainLyrics: 'simple' }),
    r({ duration: 202, syncedLyrics: '[00:01.00]synchro' }),
    r({ duration: 320, syncedLyrics: '[00:01.00]version live' }),
  ];
  expect(pickBestMatch(results, 200)?.syncedLyrics).toBe('[00:01.00]synchro');
});

test('texte simple à la bonne durée plutôt que synchro d’une autre version', () => {
  const results = [r({ duration: 320, syncedLyrics: '[00:01]live' }), r({ duration: 199, plainLyrics: 'simple' })];
  expect(pickBestMatch(results, 200)?.plainLyrics).toBe('simple');
});

test('ignore les instrumentaux et les résultats vides', () => {
  expect(pickBestMatch([r({ instrumental: true, plainLyrics: 'x' }), r({ plainLyrics: '  ' })], 200)).toBeNull();
});

test('durée inconnue : premier résultat avec paroles synchronisées', () => {
  expect(pickBestMatch([r({ plainLyrics: 'a' }), r({ syncedLyrics: '[00:01]b' })], null)?.syncedLyrics).toBe('[00:01]b');
});
