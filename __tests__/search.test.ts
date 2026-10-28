import { normalize, scoreTrack, search } from '@/search/search';
import type { Track } from '@/db/types';

const t = (id: number, title: string, artist: string, album: string): Track => ({
  id, title, artist, album, uri: `file://${id}`, filename: `${id}.mp3`, trackNo: null,
  duration: null, license: 'personal', liked: false, addedAt: 0,
});

const lib = [
  t(1, 'Électricité', 'Les Ondes', 'Courant'),
  t(2, 'Soleil', 'Électro Club', 'Été'),
  t(3, 'Pluie', 'Les Ondes', 'Météo'),
];

test('normalise accents et casse', () => expect(normalize('  Électro ')).toBe('electro'));

test('tous les mots doivent correspondre', () => {
  expect(scoreTrack(lib[2], 'pluie ondes')).toBeGreaterThan(0);
  expect(scoreTrack(lib[2], 'pluie soleil')).toBe(0);
});

test('le titre passe avant l’artiste', () => {
  const r = search(lib, 'electr');
  expect(r.tracks.map((x) => x.id)).toEqual([1, 2]);
  expect(r.artists).toEqual(['Électro Club']);
});

test('albums et requête vide', () => {
  expect(search(lib, 'meteo').albums).toEqual([{ album: 'Météo', artist: 'Les Ondes' }]);
  expect(search(lib, '   ').tracks).toEqual([]);
});
