import { luceneQuote, pickAlbum, type MbRecording } from '@/library/musicbrainz';

jest.mock('expo-constants', () => ({ expoConfig: { version: 'test' } }));

const rel = (title: string, primary: string, secondary: string[] = [], date = '2025-01-31', offset = 1, status = 'Official') => ({
  title, status, date, 'release-group': { 'primary-type': primary, 'secondary-types': secondary }, media: [{ 'track-offset': offset }],
});
const rec = (releases: ReturnType<typeof rel>[], length = 225000, artist = 'The Weeknd', score = 100): MbRecording => ({
  score, title: 'Cry For Me', length, 'artist-credit': [{ name: artist }], releases,
});
const track = { title: 'Cry For Me', artist: 'The Weeknd', duration: 224 };

test('album studio plutôt que bande originale ou compilation', () => {
  const recordings = [
    rec([rel('Hurry Up Tomorrow (Score)', 'Album', ['Soundtrack'], '2025-07-11', 16)]),
    rec([rel('Hurry Up Tomorrow', 'Album', [], '2025-01-31', 1)]),
    rec([rel('NRJ Summer Hits Only 2025', 'Album', ['Compilation'], '2025-06', 2)]),
    rec([rel('Hurry Up Tomorrow', 'Album', [], '2026-04-29', 22), rel('Hurry Up Tomorrow', 'Album', [], '2025-02-11', 22, 'Withdrawn')]),
  ];
  expect(pickAlbum(recordings, track)).toEqual({ album: 'Hurry Up Tomorrow', trackNo: 2, year: '2025' });
});

test('autre artiste ou durée très différente : ignoré', () => {
  expect(pickAlbum([rec([rel('Autre', 'Album')], 225000, 'Quelqu’un d’autre')], track)).toBeNull();
  expect(pickAlbum([rec([rel('Version longue', 'Album')], 600000)], track)).toBeNull();
});

test('artiste inconnu : on se fie au titre', () => {
  expect(pickAlbum([rec([rel('Hurry Up Tomorrow', 'Album')])], { ...track, artist: 'Artiste inconnu' })?.album).toBe('Hurry Up Tomorrow');
});

test('aucun résultat', () => expect(pickAlbum([], track)).toBeNull());

test('les guillemets ne cassent pas la requête MusicBrainz', () => {
  expect(luceneQuote('Say "Hello" \\ bye')).toBe('"Say \\"Hello\\" \\\\ bye"');
});
