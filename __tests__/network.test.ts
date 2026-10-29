// Garanties réseau : mode hors ligne, fermeture de connexion, délai maximum, rien de redemandé.
import { getNetworkStateAsync } from 'expo-network';
import { Platform } from 'react-native';
import { searchLyricsOnline } from '@/library/lrclib';
import { netFetch, OfflineError, setOfflineMode } from '@/net/network';
import { checkForUpdate } from '@/update/updater';

const mockSettings = new Map<string, string>();
const mockLookups = new Map<number, number>();

jest.mock('@/db/queries', () => ({
  getSetting: jest.fn(async (k: string) => mockSettings.get(k) ?? null),
  setSetting: jest.fn(async (k: string, v: string) => void mockSettings.set(k, v)),
  lyricsNotFoundAt: jest.fn(async (t: { id: number }) => mockLookups.get(t.id) ?? null),
  saveLyricsNotFound: jest.fn(async (t: { id: number }) => void mockLookups.set(t.id, 1)),
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(), NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR' } }));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));


const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => '' });
const track = { id: 1, title: 'Cry For Me', artist: 'The Weeknd', duration: 224 };

beforeEach(async () => {
  fetchMock.mockReset();
  mockSettings.clear();
  mockLookups.clear();
  await setOfflineMode(false);
  jest.mocked(getNetworkStateAsync).mockResolvedValue({ type: 'WIFI', isConnected: true } as never);
});

test('chaque requête demande la fermeture de la connexion', async () => {
  fetchMock.mockResolvedValue(json({}));
  await netFetch('https://exemple.org', { headers: { 'User-Agent': 'x' } });
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'User-Agent': 'x', Connection: 'close' });
});

test('mode hors ligne : rien ne part', async () => {
  await setOfflineMode(true);
  await expect(netFetch('https://exemple.org')).rejects.toBeInstanceOf(OfflineError);
  await expect(searchLyricsOnline(track)).rejects.toBeInstanceOf(OfflineError);
  expect(await checkForUpdate()).toBeNull(); // la vérification automatique se tait
  expect(fetchMock).not.toHaveBeenCalled();
});

test('délai maximum : la requête est abandonnée', async () => {
  fetchMock.mockImplementation((_url, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('abort')))));
  await expect(netFetch('https://exemple.org', { timeoutMs: 20 })).rejects.toThrow('abort');
});

test('paroles introuvables : gardé en mémoire, pas de 2e requête (sauf « quand même »)', async () => {
  fetchMock.mockResolvedValue(json([]));
  expect(await searchLyricsOnline(track)).toEqual({ kind: 'none' });
  expect((await searchLyricsOnline(track)).kind).toBe('already');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await searchLyricsOnline(track, true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

describe('vérification automatique des mises à jour', () => {
  // Les mises à jour ne concernent qu'Android (Jest simule iOS par défaut)
  beforeAll(() => Object.defineProperty(Platform, 'OS', { get: () => 'android' }));

  const release = { tag_name: 'v9.0.0', assets: [{ name: 'SCMusic-9.0.0.apk', browser_download_url: 'u', size: 1 }] };

  test('en données mobiles : attend le Wi-Fi', async () => {
    jest.mocked(getNetworkStateAsync).mockResolvedValue({ type: 'CELLULAR', isConnected: true } as never);
    expect(await checkForUpdate()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('en Wi-Fi : une fois, puis plus avant une semaine', async () => {
    fetchMock.mockResolvedValue(json(release));
    expect((await checkForUpdate())?.version).toBe('9.0.0');
    expect(await checkForUpdate()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('vérification à la main : toujours possible', async () => {
    fetchMock.mockResolvedValue(json(release));
    await checkForUpdate();
    await checkForUpdate(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
