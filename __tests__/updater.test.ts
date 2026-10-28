import { compareVersions, parseRelease } from '@/update/updater';

jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
jest.mock('@/db/queries', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));

test('comparaison de versions', () => {
  expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
  expect(compareVersions('v2.10.0', '2.9.1')).toBe(1);
  expect(compareVersions('2.0', '2.0.0')).toBe(0);
  expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
});

const asset = (name: string, size = 10) => ({ name, browser_download_url: `https://x/${name}`, size });

test('release GitHub : APK et son empreinte', () => {
  const info = parseRelease({
    tag_name: 'v2.1.0',
    body: ' Nouveautés ',
    assets: [asset('SCMusic-2.1.0.apk', 1234), asset('SCMusic-2.1.0.apk.sha256')],
  });
  expect(info).toEqual({
    version: '2.1.0',
    notes: 'Nouveautés',
    apkUrl: 'https://x/SCMusic-2.1.0.apk',
    sha256Url: 'https://x/SCMusic-2.1.0.apk.sha256',
    size: 1234,
  });
});

test('release sans APK, brouillon ou préversion : ignorée', () => {
  expect(parseRelease({ tag_name: 'v3.0.0', assets: [asset('notes.txt')] })).toBeNull();
  expect(parseRelease({ tag_name: 'v3.0.0', prerelease: true, assets: [asset('a.apk')] })).toBeNull();
});
