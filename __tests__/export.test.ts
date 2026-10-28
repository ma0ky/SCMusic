import { buildExportPlan, canShareAudio, matchTracks, parseManifest } from '@/sharing/format';
import type { Track, TrackLicense } from '@/db/types';

const t = (id: number, title: string, license: TrackLicense): Track => ({
  id, title, artist: 'Artiste', album: 'Album', uri: `content://${id}`, filename: `${id}.flac`,
  trackNo: null, duration: null, license, liked: false, addedAt: 0,
});

const bought = t(1, 'Acheté', 'personal');
const mine = t(2, 'Ma compo', 'own');
const free = t(3, 'Libre', 'cc');

test('seules les créations perso et licences libres sont exportables', () => {
  expect(canShareAudio('personal')).toBe(false);
  expect(canShareAudio('own')).toBe(true);
  expect(canShareAudio('cc')).toBe(true);
});

test('un morceau acheté n’est jamais joint, même si l’audio est demandé', () => {
  const plan = buildExportPlan([{ name: 'Mix', tracks: [bought, mine, free] }], true);
  expect(plan.audioToCopy.map((a) => a.track.id)).toEqual([2, 3]);
  expect(plan.metadataOnly.map((x) => x.id)).toEqual([1]);
  const shared = plan.manifest.playlists[0].tracks;
  expect(shared[0].file).toBeUndefined();
  expect(shared[1].file).toMatch(/^2_Artiste - Ma compo\.flac$/);
});

test('export sans audio : uniquement les infos', () => {
  const plan = buildExportPlan([{ name: 'Mix', tracks: [mine] }], false);
  expect(plan.audioToCopy).toEqual([]);
  expect(plan.manifest.playlists[0].tracks[0].file).toBeUndefined();
});

test('import : refuse les fichiers invalides', () => {
  expect(() => parseManifest('pas du json')).toThrow();
  expect(() => parseManifest('{"format":"autre"}')).toThrow();
  expect(() => parseManifest('{"format":"scmusic-share","version":99,"playlists":[]}')).toThrow();
});

test('import : ignore un fichier joint non autorisé ou un chemin suspect', () => {
  const m = parseManifest(JSON.stringify({
    format: 'scmusic-share', version: 1, playlists: [{ name: 'P', tracks: [
      { title: 'A', artist: 'X', album: '', license: 'personal', file: 'a.mp3' },
      { title: 'B', artist: 'X', album: '', license: 'cc', file: '../../evil.mp3' },
      { title: 'C', artist: 'X', album: '', license: 'own', file: 'c.mp3' },
    ] }],
  }));
  expect(m.playlists[0].tracks.map((x) => x.file)).toEqual([undefined, undefined, 'c.mp3']);
});

test('import : retrouve les morceaux de la bibliothèque (accents et casse ignorés)', () => {
  const lib = [t(10, 'Été', 'personal')];
  const r = matchTracks([{ title: 'ete', artist: 'ARTISTE', album: '', license: 'personal' }, { title: 'Absent', artist: 'Y', album: '', license: 'cc' }], lib);
  expect(r.found.map((x) => x.id)).toEqual([10]);
  expect(r.missing.map((x) => x.title)).toEqual(['Absent']);
});
