// Mises à jour sans store : les APK signés sont publiés sur un dépôt GitHub public dédié.
// À l'ouverture (au plus une fois par semaine, en Wi-Fi par défaut, jamais en mode hors ligne),
// une requête demande la dernière version.
// Si elle est plus récente et que l'utilisateur accepte : téléchargement, vérification SHA-256,
// puis l'installateur d'Android prend le relais (il refuse un APK signé avec une autre clé).
// Sécurité : on n'accepte que des fichiers du dépôt de releases (liste blanche d'adresse), et jamais
// sans empreinte. L'empreinte prouve que le fichier est intact ; c'est la signature (vérifiée par
// Android, même certificat obligatoire) qui prouve qu'il vient bien de nous.
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { getSetting, setSetting } from '@/db/queries';
import { isOfflineMode, netDownload, netFetch, OfflineError, onWifi, readJson, readText } from '@/net/network';

const RELEASES_URL = 'https://api.github.com/repos/ma0ky/SCMusic-releases/releases/latest';
/** Seules adresses de téléchargement acceptées (APK et empreinte). */
const DOWNLOAD_PREFIX = 'https://github.com/ma0ky/SCMusic-releases/releases/download/';
/** Un APK de SCMusic fait ~35 Mo : au-delà de 200 Mo, la release n'est pas normale. */
const MAX_APK_BYTES = 200 * 1024 * 1024;
const CHECK_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_CHECK_KEY = 'updateLastCheck';
const SKIPPED_KEY = 'updateSkippedVersion';
const AUTO_KEY = 'updateAutoCheck';
const WIFI_KEY = 'updateWifiOnly';
const HEADERS = {
  'User-Agent': 'SCMusic (https://github.com/ma0ky/SCMusic-releases)',
  Accept: 'application/vnd.github+json',
};

export interface UpdateInfo {
  version: string;
  notes: string;
  apkUrl: string;
  sha256Url: string;
  size: number; // octets
}

interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GithubRelease {
  tag_name: string;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  assets: GithubAsset[];
}

export const currentVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';

/** "v2.10.0" > "2.9.1" → 1 ; égalité → 0 ; plus ancienne → -1. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.replace(/^v/i, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

const fromReleases = (url: unknown): url is string => typeof url === 'string' && url.startsWith(DOWNLOAD_PREFIX) && !url.includes('..');

/**
 * Réponse GitHub → infos de mise à jour, ou null si rien d'installable. Refusé (on ne propose rien) :
 * brouillon, préversion, APK sans empreinte, adresse hors du dépôt de releases, taille anormale.
 */
export function parseRelease(release: GithubRelease): UpdateInfo | null {
  if (!release || release.draft || release.prerelease || !Array.isArray(release.assets)) return null;
  if (typeof release.tag_name !== 'string' || !/^v?\d{1,4}(\.\d{1,4}){1,3}$/.test(release.tag_name)) return null;
  const apk = release.assets.find((a) => typeof a?.name === 'string' && /\.apk$/i.test(a.name));
  if (!apk) return null;
  const sha = release.assets.find((a) => a?.name?.toLowerCase() === `${apk.name.toLowerCase()}.sha256`);
  if (!sha || !fromReleases(apk.browser_download_url) || !fromReleases(sha.browser_download_url)) return null;
  if (!(apk.size > 0 && apk.size <= MAX_APK_BYTES)) return null;
  return {
    version: release.tag_name.replace(/^v/i, ''),
    notes: String(release.body ?? '').trim().slice(0, 5000),
    apkUrl: apk.browser_download_url,
    sha256Url: sha.browser_download_url,
    size: apk.size,
  };
}

/**
 * Cherche une version plus récente. Sans `force` (vérification automatique), ne fait rien :
 * en mode hors ligne, si elle est désactivée, hors Wi-Fi (si demandé), si la dernière date
 * de moins d'une semaine, ou si l'utilisateur a choisi d'ignorer cette version.
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'android') return null;
  const last = Number(await getSetting(LAST_CHECK_KEY)) || 0;
  if (!force) {
    if ((await isOfflineMode()) || !(await getAutoCheck()) || Date.now() - last < CHECK_EVERY_MS) return null;
    if ((await getWifiOnly()) && !(await onWifi())) return null;
  }

  let res: Response;
  try {
    res = await netFetch(RELEASES_URL, { headers: HEADERS });
  } catch (e) {
    if (e instanceof OfflineError) throw e;
    throw new Error('Pas de connexion à Internet, ou GitHub ne répond pas.');
  }
  await setSetting(LAST_CHECK_KEY, String(Date.now()));
  if (res.status === 404) return null; // aucune version publiée
  if (!res.ok) throw new Error(`GitHub a répondu une erreur (${res.status}).`);

  const info = parseRelease(await readJson<GithubRelease>(res));
  if (!info || compareVersions(info.version, currentVersion()) <= 0) return null;
  if (!force && (await getSetting(SKIPPED_KEY)) === info.version) return null;
  return info;
}

/** Vérification automatique seulement en Wi-Fi (activé par défaut). */
export async function getWifiOnly(): Promise<boolean> {
  return (await getSetting(WIFI_KEY)) !== '0';
}

export async function setWifiOnly(on: boolean): Promise<void> {
  await setSetting(WIFI_KEY, on ? '1' : '0');
}

/** Vérification automatique à l'ouverture (activée par défaut). */
export async function getAutoCheck(): Promise<boolean> {
  return (await getSetting(AUTO_KEY)) !== '0';
}

export async function setAutoCheck(on: boolean): Promise<void> {
  await setSetting(AUTO_KEY, on ? '1' : '0');
}

export async function skipVersion(version: string): Promise<void> {
  await setSetting(SKIPPED_KEY, version);
}

/** Télécharge l'APK, vérifie son empreinte et ouvre l'installateur d'Android. */
export async function downloadAndInstall(info: UpdateInfo, onProgress?: (fraction: number) => void): Promise<void> {
  const dir = new Directory(Paths.cache, 'updates');
  if (dir.exists) dir.delete(); // anciens APK téléchargés
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `SCMusic-${info.version}.apk`);

  let apk: File;
  try {
    apk = await netDownload(info.apkUrl, target, {
      headers: { 'User-Agent': HEADERS['User-Agent'] },
      onProgress: ({ bytesWritten, totalBytes }) => onProgress?.(bytesWritten / (totalBytes || info.size || 1)),
    });
  } catch (e) {
    if (e instanceof OfflineError) throw e;
    throw new Error('Téléchargement interrompu. Vérifie ta connexion et réessaie.');
  }

  // Rien n'est installé sans empreinte valide : en cas de doute, on refuse (jamais l'inverse)
  if (apk.size !== info.size) {
    apk.delete();
    throw new Error('Le fichier téléchargé est incomplet. Réessaie plus tard.');
  }
  // Fichier "empreinte  nom.apk" produit par scripts/sign-apk.sh
  let expected: string;
  try {
    const res = await netFetch(info.sha256Url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    expected = (await readText(res, 1024)).trim().split(/\s+/)[0].toLowerCase();
  } catch (e) {
    apk.delete();
    if (e instanceof OfflineError) throw e;
    throw new Error('Impossible de vérifier le fichier téléchargé. Réessaie plus tard.');
  }
  const actual = await apk.digest('SHA-256');
  if (!/^[0-9a-f]{64}$/.test(expected) || expected !== actual) {
    apk.delete();
    throw new Error('Le fichier téléchargé est abîmé (empreinte différente). Réessaie plus tard.');
  }

  await startActivityAsync('android.intent.action.VIEW', {
    data: apk.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION : l'installateur peut lire le fichier
  });
}
