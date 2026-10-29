import { applyLang, tr } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { checkCover } from '@/library/covers';
import { formToPatch } from '@/library/trackInfo';
import { formatListening, longLabel } from '@/stats/listening';

/** Toutes les clés d'un dictionnaire, ex. "common.cancel". */
function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

afterEach(() => applyLang('fr'));

test('français et anglais ont exactement les mêmes clés', () => {
  expect(keys(en).sort()).toEqual(keys(fr).sort());
  expect(en.dates.days).toHaveLength(7);
  expect(en.dates.months).toHaveLength(12);
});

test('pluriels propres à chaque langue', () => {
  expect(fr.common.tracks(0)).toBe('0 titre');
  expect(en.common.tracks(0)).toBe('0 tracks');
  expect(en.common.tracks(1)).toBe('1 track');
  expect(fr.home.likedCount(2)).toBe('2 morceaux');
});

test('dates, durées et erreurs suivent la langue choisie', () => {
  expect(tr()).toBe(fr);
  applyLang('en');
  expect(longLabel('2026-10-28')).toBe('Wed Oct 28');
  expect(longLabel('2026-10')).toBe('Oct 2026');
  expect(formatListening(11520)).toBe('3 h 12 min');
  expect(() => checkCover(Uint8Array.of(0, 1, 2, 3))).toThrow('valid JPEG or PNG');
  expect(formToPatch({ title: '', artist: '', album: '', trackNo: '' }, false)).toEqual({ ok: false, error: en.trackEdit.emptyTitle });
  applyLang('fr');
  expect(longLabel('2026-10-28')).toBe('mer. 28 oct.');
});
