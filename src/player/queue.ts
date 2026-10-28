// Logique pure de la file d'attente : aucune dépendance à l'audio ni à React,
// ce qui permet de la tester facilement (voir __tests__/queue.test.ts).
// Chaque fonction renvoie un NOUVEL état au lieu de modifier l'ancien.

export type RepeatMode = 'off' | 'all' | 'one';

/** Un élément de la file. `uid` distingue deux fois le même morceau. */
export interface QueueEntry<T> {
  uid: number;
  item: T;
}

export interface QueueState<T> {
  original: QueueEntry<T>[]; // ordre "normal", restauré quand on coupe le shuffle
  order: QueueEntry<T>[]; // ordre réellement joué
  index: number; // position dans `order` (-1 si file vide)
  shuffle: boolean;
  repeat: RepeatMode;
  nextUid: number;
}

export function emptyQueue<T>(): QueueState<T> {
  return { original: [], order: [], index: -1, shuffle: false, repeat: 'off', nextUid: 1 };
}

function wrap<T>(items: T[], firstUid: number): QueueEntry<T>[] {
  return items.map((item, i) => ({ uid: firstUid + i, item }));
}

/** Mélange Fisher-Yates. `random` est injectable pour les tests. */
function shuffled<E>(list: E[], random: () => number): E[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Remplace la file par `items` et démarre sur `startIndex`. */
export function loadQueue<T>(
  state: QueueState<T>,
  items: T[],
  startIndex = 0,
  random: () => number = Math.random,
): QueueState<T> {
  const original = wrap(items, state.nextUid);
  const base = { ...state, original, nextUid: state.nextUid + items.length };
  if (items.length === 0) return { ...base, order: [], index: -1 };
  const start = Math.min(Math.max(startIndex, 0), items.length - 1);
  if (!state.shuffle) return { ...base, order: original, index: start };
  // En shuffle, le morceau choisi joue en premier, le reste est mélangé.
  const first = original[start];
  const rest = shuffled(original.filter((e) => e !== first), random);
  return { ...base, order: [first, ...rest], index: 0 };
}

export function current<T>(state: QueueState<T>): T | null {
  return state.order[state.index]?.item ?? null;
}

/**
 * Passe au morceau suivant.
 * `auto` = fin naturelle du morceau (repeat "one" rejoue alors le même).
 * `ended` = vrai si la file est terminée (rien à jouer ensuite).
 */
export function next<T>(state: QueueState<T>, auto = false): { state: QueueState<T>; ended: boolean } {
  if (state.order.length === 0) return { state, ended: true };
  if (auto && state.repeat === 'one') return { state, ended: false };
  if (state.index < state.order.length - 1) {
    return { state: { ...state, index: state.index + 1 }, ended: false };
  }
  if (state.repeat !== 'off') return { state: { ...state, index: 0 }, ended: false };
  return { state, ended: true };
}

export function previous<T>(state: QueueState<T>): QueueState<T> {
  if (state.order.length === 0) return state;
  if (state.index > 0) return { ...state, index: state.index - 1 };
  return { ...state, index: state.repeat === 'all' ? state.order.length - 1 : 0 };
}

export function jumpTo<T>(state: QueueState<T>, index: number): QueueState<T> {
  if (index < 0 || index >= state.order.length) return state;
  return { ...state, index };
}

export function setShuffle<T>(
  state: QueueState<T>,
  on: boolean,
  random: () => number = Math.random,
): QueueState<T> {
  if (on === state.shuffle) return state;
  const playing = state.order[state.index];
  if (!playing) return { ...state, shuffle: on };
  if (on) {
    const rest = shuffled(state.order.filter((e) => e !== playing), random);
    return { ...state, shuffle: true, order: [playing, ...rest], index: 0 };
  }
  return {
    ...state,
    shuffle: false,
    order: state.original,
    index: state.original.indexOf(playing),
  };
}

export function cycleRepeat<T>(state: QueueState<T>): QueueState<T> {
  const nextMode: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };
  return { ...state, repeat: nextMode[state.repeat] };
}

/** Ajoute à la fin de la file. */
export function enqueue<T>(state: QueueState<T>, item: T): QueueState<T> {
  const entry = { uid: state.nextUid, item };
  return {
    ...state,
    original: [...state.original, entry],
    order: [...state.order, entry],
    index: state.index === -1 ? 0 : state.index,
    nextUid: state.nextUid + 1,
  };
}

/** Insère juste après le morceau en cours ("Lire ensuite"). */
export function playNext<T>(state: QueueState<T>, item: T): QueueState<T> {
  if (state.index === -1) return enqueue(state, item);
  const entry = { uid: state.nextUid, item };
  const playing = state.order[state.index];
  const insertAfter = <E>(list: E[], ref: E) => {
    const at = list.indexOf(ref) + 1;
    return [...list.slice(0, at), entry as unknown as E, ...list.slice(at)];
  };
  return {
    ...state,
    original: insertAfter(state.original, playing),
    order: insertAfter(state.order, playing),
    nextUid: state.nextUid + 1,
  };
}

/** Déplace un élément de la file (réorganisation), en gardant le morceau en cours. */
export function moveItem<T>(state: QueueState<T>, from: number, to: number): QueueState<T> {
  const n = state.order.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return state;
  const playing = state.order[state.index];
  const order = [...state.order];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return {
    ...state,
    order,
    original: state.shuffle ? state.original : order,
    index: order.indexOf(playing),
  };
}

/** Retire un élément. Si c'est le morceau en cours, l'index pointe sur le suivant. */
export function removeAt<T>(state: QueueState<T>, index: number): QueueState<T> {
  if (index < 0 || index >= state.order.length) return state;
  const removed = state.order[index];
  const order = state.order.filter((e) => e !== removed);
  let newIndex = state.index;
  if (index < state.index) newIndex -= 1;
  if (newIndex >= order.length) newIndex = order.length - 1;
  return {
    ...state,
    order,
    original: state.original.filter((e) => e !== removed),
    index: order.length === 0 ? -1 : newIndex,
  };
}
