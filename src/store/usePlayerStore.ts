// État global du lecteur (Zustand) : file d'attente + actions appelées par les écrans.
// La logique de file vient de player/queue.ts, le son de player/engine.ts.
import { create } from 'zustand';
import * as Q from '@/player/queue';
import * as engine from '@/player/engine';
import { markPlayed, setDuration, setLicense, setLiked } from '@/db/queries';
import type { Track, TrackLicense } from '@/db/types';

/** "Précédent" revient au début du morceau s'il joue depuis plus de 3 s. */
const RESTART_THRESHOLD = 3;

interface PlayerState {
  queue: Q.QueueState<Track>;
  volume: number;
  /** Incrémenté quand la bibliothèque change : les écrans rechargent leurs données. */
  libraryVersion: number;

  playTracks: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  enqueue: (t: Track) => void;
  playNext: (t: Track) => void;
  moveInQueue: (from: number, to: number) => void;
  removeFromQueue: (index: number) => void;
  jumpTo: (index: number) => void;
  toggleLike: (t: Track) => Promise<void>;
  changeLicense: (t: Track, license: TrackLicense) => Promise<void>;
  libraryChanged: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  /** Applique un nouvel état de file et charge l'audio si le morceau courant a changé. */
  const apply = (queue: Q.QueueState<Track>, opts: { forceReload?: boolean; autoplay?: boolean } = {}) => {
    const before = get().queue.order[get().queue.index]?.uid;
    const after = queue.order[queue.index];
    set({ queue });
    if (!after) {
      engine.stop();
      return;
    }
    if (after.uid !== before || opts.forceReload) {
      engine.loadAndPlay(after.item, opts.autoplay ?? true);
      markPlayed(after.item.id).catch(() => {});
    }
  };

  /** Met à jour un morceau partout dans la file (ex. après un "j'aime"). */
  const patchTrack = (id: number, patch: Partial<Track>) => {
    const q = get().queue;
    const fix = (list: Q.QueueEntry<Track>[]) =>
      list.map((e) => (e.item.id === id ? { ...e, item: { ...e.item, ...patch } } : e));
    set({ queue: { ...q, order: fix(q.order), original: fix(q.original) } });
  };

  // Fin naturelle d'un morceau → suivant (ou rejouer si repeat "one").
  engine.onStatus((status) => {
    const playing = Q.current(get().queue);
    if (playing && status.isLoaded && status.duration > 0 && playing.duration == null) {
      setDuration(playing.id, status.duration).catch(() => {});
      patchTrack(playing.id, { duration: status.duration });
    }
    if (!status.didJustFinish) return;
    const { state, ended } = Q.next(get().queue, true);
    if (ended) {
      engine.getPlayer().seekTo(0).catch(() => {});
      engine.getPlayer().pause();
      return;
    }
    apply(state, { forceReload: state.index === get().queue.index });
  });

  return {
    queue: Q.emptyQueue<Track>(),
    volume: 1,
    libraryVersion: 0,

    playTracks: (tracks, startIndex = 0) => apply(Q.loadQueue(get().queue, tracks, startIndex), { forceReload: true }),

    togglePlay: () => {
      const p = engine.getPlayer();
      if (!Q.current(get().queue)) return;
      if (p.playing) p.pause();
      else p.play();
    },

    next: () => {
      const { state, ended } = Q.next(get().queue);
      if (!ended) apply(state, { forceReload: true });
    },

    previous: () => {
      const p = engine.getPlayer();
      if (p.currentTime > RESTART_THRESHOLD || (get().queue.index === 0 && get().queue.repeat !== 'all')) {
        p.seekTo(0).catch(() => {});
        return;
      }
      apply(Q.previous(get().queue), { forceReload: true });
    },

    seek: (seconds) => {
      engine.getPlayer().seekTo(Math.max(0, seconds)).catch(() => {});
    },

    setVolume: (v) => {
      const volume = Math.min(1, Math.max(0, v));
      engine.getPlayer().volume = volume;
      set({ volume });
    },

    toggleShuffle: () => set({ queue: Q.setShuffle(get().queue, !get().queue.shuffle) }),
    cycleRepeat: () => set({ queue: Q.cycleRepeat(get().queue) }),
    enqueue: (t) => apply(Q.enqueue(get().queue, t)),
    playNext: (t) => apply(Q.playNext(get().queue, t)),
    moveInQueue: (from, to) => set({ queue: Q.moveItem(get().queue, from, to) }),
    removeFromQueue: (index) => apply(Q.removeAt(get().queue, index)),
    jumpTo: (index) => apply(Q.jumpTo(get().queue, index), { forceReload: true }),

    toggleLike: async (t) => {
      await setLiked(t.id, !t.liked);
      patchTrack(t.id, { liked: !t.liked });
      get().libraryChanged();
    },

    changeLicense: async (t, license) => {
      await setLicense(t.id, license);
      patchTrack(t.id, { license });
      get().libraryChanged();
    },

    libraryChanged: () => set({ libraryVersion: get().libraryVersion + 1 }),
  };
});

/** Morceau en cours (ou null). */
export const useCurrentTrack = () => usePlayerStore((s) => s.queue.order[s.queue.index]?.item ?? null);
