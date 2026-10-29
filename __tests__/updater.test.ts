import { compareVersions, parseRelease } from '@/update/updater';

jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
jest.mock('@/db/queries', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));

test('comparaison de versions', () => {
  expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
  expect(compareVersions('v2.10.0', '2.9.1')).toBe(1);
  expect(compareVersions('2.0', '2.0.0')).toBe(0);
  expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
});

const BASE = 'https://github.com/ma0ky/SCMusic-releases/releases/download/v2.1.0/';
const asset = (name: string, size = 10, base = BASE) => ({ name, browser_download_url: `${base}${name}`, size });

test('release GitHub : APK et son empreinte', () => {
  const info = parseRelease({
    tag_name: 'v2.1.0',
    body: ' Nouveautés ',
    assets: [asset('SCMusic-2.1.0.apk', 1234), asset('SCMusic-2.1.0.apk.sha256')],
  });
  expect(info).toEqual({
    version: '2.1.0',
    notes: 'Nouveautés',
    apkUrl: `${BASE}SCMusic-2.1.0.apk`,
    sha256Url: `${BASE}SCMusic-2.1.0.apk.sha256`,
    size: 1234,
  });
});

test('release sans APK, brouillon ou préversion : ignorée', () => {
  expect(parseRelease({ tag_name: 'v3.0.0', assets: [asset('notes.txt')] })).toBeNull();
  expect(parseRelease({ tag_name: 'v3.0.0', prerelease: true, assets: [asset('a.apk')] })).toBeNull();
});

test('release refusée : sans empreinte, hors du dépôt de releases, taille ou version anormale', () => {
  const sha = asset('SCMusic-3.0.0.apk.sha256');
  expect(parseRelease({ tag_name: 'v3.0.0', assets: [asset('SCMusic-3.0.0.apk')] })).toBeNull();
  expect(parseRelease({ tag_name: 'v3.0.0', assets: [asset('SCMusic-3.0.0.apk', 10, 'https://evil.example/'), sha] })).toBeNull();
  expect(parseRelease({ tag_name: 'v3.0.0', assets: [asset('SCMusic-3.0.0.apk', 10, `${BASE}../../../x/`), sha] })).toBeNull();
  expect(parseRelease({ tag_name: 'v3.0.0', assets: [asset('SCMusic-3.0.0.apk', 0), sha] })).toBeNull();
  expect(parseRelease({ tag_name: 'v3.0.0', assets: [asset('SCMusic-3.0.0.apk', 500 * 1024 * 1024), sha] })).toBeNull();
  expect(parseRelease({ tag_name: '<script>', assets: [asset('SCMusic-3.0.0.apk'), sha] })).toBeNull();
});
