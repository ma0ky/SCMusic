import {
  advance, bucketsFor, countsAsPlay, fillBuckets, formatListening, isComplete, longLabel, newSession,
} from '@/stats/listening';

describe('temps écouté', () => {
  const t0 = 1_000_000;
  const start = newSession(1, 200, t0);

  test('compte la lecture normale', () => {
    let s = advance(start, 0, true, t0);
    s = advance(s, 0.25, true, t0 + 250);
    s = advance(s, 0.5, true, t0 + 500);
    expect(s.listened).toBeCloseTo(0.5);
  });

  test('ignore un saut en avant ou en arrière', () => {
    let s = advance(start, 10, true, t0);
    s = advance(s, 120, true, t0 + 250); // saut à 2:00
    expect(s.listened).toBe(0);
    s = advance(s, 120.25, true, t0 + 500);
    s = advance(s, 5, true, t0 + 750); // retour au début
    expect(s.listened).toBeCloseTo(0.25);
  });

  test('ne compte pas la pause', () => {
    let s = advance(start, 10, false, t0);
    s = advance(s, 10, false, t0 + 60_000);
    expect(s.listened).toBe(0);
  });

  test('statuts espacés (écran éteint) : comptés si l’horloge suit', () => {
    let s = advance(start, 10, true, t0);
    s = advance(s, 40, true, t0 + 30_000);
    expect(s.listened).toBeCloseTo(30);
  });
});

test('seuil d’une écoute : 30 s, ou la moitié d’un morceau court', () => {
  expect(countsAsPlay(29, 200)).toBe(false);
  expect(countsAsPlay(30, 200)).toBe(true);
  expect(countsAsPlay(21, 40)).toBe(true);
  expect(countsAsPlay(30, null)).toBe(true);
  expect(isComplete(185, 200)).toBe(true);
  expect(isComplete(100, 200)).toBe(false);
});

describe('périodes', () => {
  const now = new Date(2026, 9, 28, 15, 30); // mer. 28 oct. 2026

  test('7 jours : de jeudi à aujourd’hui', () => {
    const b = bucketsFor('week', now, null);
    expect(b.unit).toBe('day');
    expect(b.keys).toHaveLength(7);
    expect(b.keys[0]).toBe('2026-10-22');
    expect(b.keys[6]).toBe('2026-10-28');
    expect(b.labels[6]).toBe('mer.');
    expect(b.since).toBe(new Date(2026, 9, 22).getTime());
  });

  test('12 mois : passe à l’année précédente', () => {
    const b = bucketsFor('year', now, null);
    expect(b.keys[0]).toBe('2025-11');
    expect(b.keys[11]).toBe('2026-10');
  });

  test('depuis toujours : à partir du premier mois écouté', () => {
    const b = bucketsFor('all', now, new Date(2026, 7, 3).getTime());
    expect(b.keys).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(b.since).toBe(0);
  });

  test('cases vides à 0', () => {
    expect(fillBuckets(['a', 'b', 'c'], [{ key: 'b', seconds: 60 }])).toEqual([0, 60, 0]);
  });
});

test('affichage des durées et dates', () => {
  expect(formatListening(11520)).toBe('3 h 12 min');
  expect(formatListening(7200)).toBe('2 h');
  expect(formatListening(2520)).toBe('42 min');
  expect(formatListening(20)).toBe('< 1 min');
  expect(longLabel('2026-10-28')).toBe('mer. 28 oct.');
  expect(longLabel('2026-10')).toBe('oct. 2026');
});
