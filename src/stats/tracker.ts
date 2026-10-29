// Enregistre les écoutes pendant la lecture. Le store l'appelle quand un morceau démarre,
// et à chaque statut du lecteur. Une écoute est écrite dès qu'elle compte (30 s),
// puis mise à jour régulièrement : rien n'est perdu si l'app est fermée en cours de route.
import type { AudioStatus } from 'expo-audio';
import { logWarn } from '@/log';
import { insertPlay, updatePlay } from '@/db/queries';
import type { Track } from '@/db/types';
import { advance, countsAsPlay, isComplete, newSession, type ListenSession } from './listening';

/** Écart (s) d'écoute entre deux mises à jour de la base. */
const SAVE_EVERY = 15;

interface Live {
  session: ListenSession;
  playId: number | null;
  queued: number; // secondes écoutées lors de la dernière écriture demandée (-1 = jamais)
  chain: Promise<void>; // écritures en série, dans l'ordre
}

let live: Live | null = null;

function save(l: Live, final: boolean): void {
  const { listened, duration, trackId, startedAt } = l.session;
  if (!countsAsPlay(listened, duration)) return;
  if (!final && l.queued >= 0 && listened - l.queued < SAVE_EVERY) return;
  if (final && listened === l.queued) return;
  l.queued = listened;
  const completed = isComplete(listened, duration);
  l.chain = l.chain
    .then(async () => {
      if (l.playId == null) l.playId = await insertPlay(trackId, startedAt, listened, completed);
      else await updatePlay(l.playId, listened, completed);
    })
    .catch((e) => logWarn('Statistiques :', e));
}

/** Termine l'écoute en cours (morceau suivant, fin de file…). */
export function endListening(): void {
  if (live) save(live, true);
  live = null;
}

/** Un nouveau morceau commence (y compris le même rejoué). */
export function startListening(track: Track): void {
  endListening();
  live = { session: newSession(track.id, track.duration, Date.now()), playId: null, queued: -1, chain: Promise.resolve() };
}

export function onListeningStatus(status: AudioStatus): void {
  if (!live || !status.isLoaded) return;
  const session = advance(live.session, status.currentTime, status.playing, Date.now());
  if (!session.duration && status.duration > 0) session.duration = status.duration;
  live.session = session;
  save(live, false);
}
