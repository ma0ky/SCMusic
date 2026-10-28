import { cleanField, commonValue, formToPatch, MAX_FIELD_LENGTH, parseIds } from '@/library/trackInfo';

describe('nettoyage des champs', () => {
  test('caractères de contrôle, octet nul et retours à la ligne retirés', () => {
    expect(cleanField('  Mon\u0000 album\n\ttest  ')).toBe('Mon album test');
  });
  test('caractères de direction (RTLO) retirés', () => {
    expect(cleanField('photo\u202Egpj.exe')).toBe('photo gpj.exe');
  });
  test('longueur limitée', () => {
    expect(cleanField('a'.repeat(500))).toHaveLength(MAX_FIELD_LENGTH);
  });
  test('les chemins restent du texte (jamais utilisés comme chemin)', () => {
    expect(cleanField('../../etc/passwd')).toBe('../../etc/passwd');
  });
});

describe('formulaire → modifications', () => {
  const form = { title: ' Cry For Me ', artist: 'The Weeknd', album: '', trackNo: '3' };

  test('un titre : tout est appliqué, album vide = inconnu', () => {
    expect(formToPatch(form, false)).toEqual({
      ok: true,
      patch: { title: 'Cry For Me', artist: 'The Weeknd', album: 'Album inconnu', trackNo: 3 },
    });
  });

  test('un titre : titre obligatoire, numéro vide = retiré', () => {
    expect(formToPatch({ ...form, title: '  ' }, false).ok).toBe(false);
    expect(formToPatch({ ...form, trackNo: '' }, false)).toMatchObject({ ok: true, patch: { trackNo: null } });
  });

  test('plusieurs titres : seuls les champs remplis', () => {
    expect(formToPatch({ title: 'ignoré', artist: '', album: 'After Hours', trackNo: '' }, true)).toEqual({
      ok: true,
      patch: { album: 'After Hours' },
    });
    expect(formToPatch({ title: '', artist: ' ', album: '', trackNo: '' }, true).ok).toBe(false);
  });

  test('numéro invalide refusé', () => {
    for (const n of ['0', '-1', '1e3', '12a', '1000', '3.5']) expect(formToPatch({ ...form, trackNo: n }, false).ok).toBe(false);
  });
});

test('identifiants de route : seuls les entiers positifs, sans doublon', () => {
  expect(parseIds('3,1,3,x,-2,../4,0,7')).toEqual([3, 1, 7]);
  expect(parseIds(undefined)).toEqual([]);
  expect(parseIds(['1', '2'])).toEqual([1, 2]);
});

test('valeur commune pour une édition groupée', () => {
  expect(commonValue(['A', 'A'])).toBe('A');
  expect(commonValue(['A', 'B'])).toBe('');
  expect(commonValue([])).toBe('');
});
