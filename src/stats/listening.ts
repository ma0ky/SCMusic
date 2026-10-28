// Comptage des écoutes (logique pure, testée) : combien de secondes ont vraiment été écoutées,
// et à partir de quand un morceau compte comme "écouté".

/** Une écoute compte après 30 s (ou la moitié d'un morceau très court), comme sur la plupart des services. */
export const COUNT_AFTER = 30;
/** Au-delà de 90 % du morceau, l'écoute est considérée comme complète. */
const COMPLETE_RATIO = 0.9;
/** Marge (s) entre l'avancée de la lecture et le temps réel écoulé : au-delà, c'est un saut dans le morceau. */
const SEEK_MARGIN = 1.5;

export interface ListenSession {
  trackId: number;
  startedAt: number; // ms (horloge du téléphone)
  duration: number | null; // s
  lastPosition: number | null; // position du morceau au dernier statut (s)
  lastWall: number | null; // horloge au dernier statut (ms)
  listened: number; // secondes réellement écoutées
}

export function newSession(trackId: number, duration: number | null, now: number): ListenSession {
  return { trackId, startedAt: now, duration, lastPosition: null, lastWall: null, listened: 0 };
}

/**
 * Ajoute le temps écouté depuis le dernier statut du lecteur. On ne compte que l'avancée
 * "naturelle" de la lecture : un saut en avant (plus rapide que le temps réel) ou en arrière
 * n'ajoute rien. Les statuts espacés (écran éteint) restent comptés grâce à l'horloge.
 */
export function advance(s: ListenSession, position: number, playing: boolean, now: number): ListenSession {
  const next = { ...s, lastPosition: position, lastWall: now };
  if (!playing || s.lastPosition == null || s.lastWall == null) return next;
  const moved = position - s.lastPosition;
  const elapsed = (now - s.lastWall) / 1000;
  if (moved > 0 && moved <= elapsed + SEEK_MARGIN) next.listened = s.listened + moved;
  return next;
}

export function countsAsPlay(listened: number, duration: number | null): boolean {
  const threshold = duration && duration > 0 ? Math.min(COUNT_AFTER, duration / 2) : COUNT_AFTER;
  return listened >= threshold;
}

export function isComplete(listened: number, duration: number | null): boolean {
  return !!duration && listened >= duration * COMPLETE_RATIO;
}

// ---------- Périodes et regroupement ----------

export type Period = 'week' | 'month' | 'year' | 'all';

export interface Buckets {
  since: number; // ms : début de la période
  unit: 'day' | 'month';
  keys: string[]; // "2026-10-28" ou "2026-10", même format que la requête SQL
  labels: string[]; // libellés courts pour l'axe
}

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** Pour "Depuis toujours", au plus 3 ans de mois sur le graphique. */
const MAX_MONTHS = 36;

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** "2026-10-28" → "mar. 28 oct." ; "2026-10" → "oct. 2026" (pour les infobulles). */
export function longLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (d == null) return `${MONTHS[m - 1]} ${y}`;
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** Cases du graphique pour une période, à partir de maintenant (heure locale). */
export function bucketsFor(period: Period, now: Date, firstPlay: number | null): Buckets {
  if (period === 'week' || period === 'month') {
    const count = period === 'week' ? 7 : 30;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1));
    const keys: string[] = [];
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      keys.push(dayKey(d));
      labels.push(period === 'week' ? DAYS[d.getDay()] : String(d.getDate()));
    }
    return { since: start.getTime(), unit: 'day', keys, labels };
  }
  let months = 12;
  if (period === 'all') {
    const first = firstPlay != null ? new Date(firstPlay) : now;
    months = (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1;
    months = Math.min(Math.max(months, 1), MAX_MONTHS);
  }
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    keys.push(monthKey(d));
    labels.push(MONTHS[d.getMonth()]);
  }
  return { since: period === 'all' ? 0 : start.getTime(), unit: 'month', keys, labels };
}

/** Répartit les totaux SQL dans les cases (0 pour une case sans écoute). */
export function fillBuckets(keys: string[], rows: { key: string; seconds: number }[]): number[] {
  const byKey = new Map(rows.map((r) => [r.key, r.seconds]));
  return keys.map((k) => byKey.get(k) ?? 0);
}

/** 11520 → "3 h 12 min" ; 2520 → "42 min" ; 20 → "< 1 min". */
export function formatListening(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return seconds > 0 ? '< 1 min' : '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${pad(m)} min` : `${h} h`;
}
