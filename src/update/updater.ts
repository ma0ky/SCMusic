// Mises à jour sans store : les APK signés sont publiés sur un dépôt GitHub public dédié.
// À l'ouverture (au plus une fois par jour), une requête demande la dernière version.
// Si elle est plus récente et que l'utilisateur accepte : téléchargement, vérification SHA-256,
// puis l'installateur d'Android prend le relais (il refuse un APK signé avec une autre clé).
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { getSetting, setSetting } from '@/db/queries';

const RELEASES_URL = 'https://api.github.com/repos/ma0ky/SCMusic-releases/releases/latest';
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
const LAST_CHECK_KEY = 'updateLastCheck';
const SKIPPED_KEY = 'updateSkippedVersion';
const AUTO_KEY = 'updateAutoCheck';
const HEADERS = {
  'User-Agent': 'SCMusic (https://github.com/ma0ky/SCMusic-releases)',
  Accept: 'application/vnd.github+json',
  Connection: 'close', // rien ne reste ouvert après la vérification
};

export interface UpdateInfo {
  version: string;
  notes: string;
  apkUrl: string;
  sha256Url: string | null;
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

/** Réponse GitHub → infos de mise à jour, ou null si pas d'APK publié. */
export function parseRelease(release: GithubRelease): UpdateInfo | null {
  if (release.draft || release.prerelease) return null;
  const apk = release.assets.find((a) => /\.apk$/i.test(a.name));
  if (!apk) return null;
  const sha = release.assets.find((a) => a.name.toLowerCase() === `${apk.name.toLowerCase()}.sha256`);
  return {
    version: release.tag_name.replace(/^v/i, ''),
    notes: (release.body ?? '').trim(),
    apkUrl: apk.browser_download_url,
    sha256Url: sha?.browser_download_url ?? null,
    size: apk.size,
  };
}

/**
 * Cherche une version plus récente. Sans `force`, ne fait rien si la dernière vérification
 * date de moins d'un jour ou si l'utilisateur a choisi d'ignorer cette version.
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'android') return null;
  const last = Number(await getSetting(LAST_CHECK_KEY)) || 0;
  if (!force && (!(await getAutoCheck()) || Date.now() - last < CHECK_EVERY_MS)) return null;

  let res: Response;
  try {
    res = await fetch(RELEASES_URL, { headers: HEADERS });
  } catch {
    throw new Error('Pas de connexion à Internet.');
  }
  await setSetting(LAST_CHECK_KEY, String(Date.now()));
  if (res.status === 404) return null; // aucune version publiée
  if (!res.ok) throw new Error(`GitHub a répondu une erreur (${res.status}).`);

  const info = parseRelease((await res.json()) as GithubRelease);
  if (!info || compareVersions(info.version, currentVersion()) <= 0) return null;
  if (!force && (await getSetting(SKIPPED_KEY)) === info.version) return null;
  return info;
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
    apk = await File.downloadFileAsync(info.apkUrl, target, {
      idempotent: true,
      headers: { 'User-Agent': HEADERS['User-Agent'] },
      onProgress: ({ bytesWritten, totalBytes }) => onProgress?.(bytesWritten / (totalBytes || info.size || 1)),
    });
  } catch {
    throw new Error('Téléchargement interrompu. Vérifie ta connexion et réessaie.');
  }

  if (info.sha256Url) {
    // Fichier "empreinte  nom.apk" produit par scripts/sign-apk.sh
    const expected = (await (await fetch(info.sha256Url, { headers: HEADERS })).text()).trim().split(/\s+/)[0].toLowerCase();
    const actual = await apk.digest('SHA-256');
    if (expected !== actual) {
      apk.delete();
      throw new Error("Le fichier téléchargé est abîmé (empreinte différente). Réessaie plus tard.");
    }
  }

  await startActivityAsync('android.intent.action.VIEW', {
    data: apk.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION : l'installateur peut lire le fichier
  });
}
