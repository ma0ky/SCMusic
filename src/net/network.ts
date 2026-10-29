// Point de passage unique pour toute connexion de l'app (paroles, albums, mises à jour).
// - Mode hors ligne : un interrupteur des réglages bloque toute requête avant qu'elle parte.
// - Chaque requête a un délai maximum et demande la fermeture de la connexion dès la réponse.
import { File, type Directory } from 'expo-file-system';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { getSetting, setSetting } from '@/db/queries';

export const TIMEOUT_MS = 15000;
const OFFLINE_KEY = 'offlineMode';

export const OFFLINE_MESSAGE = 'Mode hors ligne activé : désactive-le dans Réglages → Réseau pour utiliser Internet.';

/** Erreur levée quand le mode hors ligne bloque une requête (à distinguer d'une vraie panne réseau). */
export class OfflineError extends Error {
  constructor() {
    super(OFFLINE_MESSAGE);
    this.name = 'OfflineError';
  }
}

let offlineCache: boolean | null = null;

export async function isOfflineMode(): Promise<boolean> {
  if (offlineCache == null) offlineCache = (await getSetting(OFFLINE_KEY)) === '1';
  return offlineCache;
}

export async function setOfflineMode(on: boolean): Promise<void> {
  offlineCache = on;
  await setSetting(OFFLINE_KEY, on ? '1' : '0');
}

/** Le téléphone est-il connecté en Wi-Fi ? (faux en données mobiles, ou si l'état est inconnu) */
export async function onWifi(): Promise<boolean> {
  try {
    const state = await getNetworkStateAsync();
    return state.type === NetworkStateType.WIFI && state.isConnected === true;
  } catch {
    return false;
  }
}

export interface NetFetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal; // arrêt demandé par l'appelant (ex. bouton "Arrêter")
  timeoutMs?: number;
}

/**
 * fetch() avec mode hors ligne, délai maximum et fermeture de la connexion.
 * Lève OfflineError si le mode hors ligne est actif ; les autres erreurs réseau remontent telles quelles.
 */
export async function netFetch(url: string, { headers, signal, timeoutMs = TIMEOUT_MS }: NetFetchOptions = {}): Promise<Response> {
  if (await isOfflineMode()) throw new OfflineError();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { ...headers, Connection: 'close' } });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** Téléchargement d'un fichier, avec les mêmes règles que netFetch (sauf le délai : un gros fichier peut être long). */
export async function netDownload(
  url: string,
  destination: File | Directory,
  options: { headers?: Record<string, string>; onProgress?: (p: { bytesWritten: number; totalBytes: number }) => void },
): Promise<File> {
  if (await isOfflineMode()) throw new OfflineError();
  return File.downloadFileAsync(url, destination, {
    idempotent: true,
    headers: { ...options.headers, Connection: 'close' },
    onProgress: options.onProgress,
  });
}
