import {
  current, cycleRepeat, emptyQueue, enqueue, jumpTo, loadQueue, moveItem, next, playNext, previous, removeAt, setShuffle,
} from '@/player/queue';

const items = ['a', 'b', 'c', 'd'];
const load = (start = 0) => loadQueue(emptyQueue<string>(), items, start);
const ids = (s: ReturnType<typeof load>) => s.order.map((e) => e.item);
// "aléatoire" déterministe : toujours 0 → inverse l'ordre du reste
const fixedRandom = () => 0;

describe('file d’attente', () => {
  test('charge et démarre sur le morceau choisi', () => {
    expect(current(load(2))).toBe('c');
    expect(current(emptyQueue())).toBeNull();
  });

  test('suivant / précédent sans répétition', () => {
    let s = load();
    s = next(s).state;
    expect(current(s)).toBe('b');
    s = previous(s);
    expect(current(s)).toBe('a');
    expect(current(previous(s))).toBe('a'); // reste au début
  });

  test('fin de file sans répétition', () => {
    const r = next(load(3));
    expect(r.ended).toBe(true);
    expect(current(r.state)).toBe('d');
  });

  test('repeat all boucle, repeat one rejoue en fin naturelle seulement', () => {
    let s = cycleRepeat(load(3)); // all
    expect(s.repeat).toBe('all');
    expect(current(next(s).state)).toBe('a');
    expect(current(previous(cycleRepeat(cycleRepeat(load(0)))))).toBe('a'); // one → previous au début
    s = cycleRepeat(s); // one
    expect(current(next(s, true).state)).toBe('d');
    expect(current(next(s, false).state)).toBe('a');
    expect(cycleRepeat(s).repeat).toBe('off');
  });

  test('shuffle garde le morceau en cours en tête puis restaure l’ordre', () => {
    let s = load(1);
    s = setShuffle(s, true, fixedRandom);
    expect(current(s)).toBe('b');
    expect(s.index).toBe(0);
    expect([...ids(s)].sort()).toEqual(items);
    s = next(s).state;
    const playing = current(s);
    s = setShuffle(s, false);
    expect(ids(s)).toEqual(items);
    expect(current(s)).toBe(playing);
  });

  test('charger en mode shuffle démarre sur le morceau choisi', () => {
    const s = loadQueue(setShuffle(emptyQueue<string>(), true), items, 2, fixedRandom);
    expect(current(s)).toBe('c');
    expect(s.order).toHaveLength(4);
  });

  test('réorganisation conserve le morceau en cours', () => {
    let s = load(1); // b
    s = moveItem(s, 0, 3);
    expect(ids(s)).toEqual(['b', 'c', 'd', 'a']);
    expect(current(s)).toBe('b');
    expect(moveItem(s, 0, 9)).toBe(s); // hors limites : rien ne change
  });

  test('ajout en fin et "lire ensuite"', () => {
    let s = load(1);
    s = enqueue(s, 'z');
    expect(ids(s).at(-1)).toBe('z');
    s = playNext(s, 'y');
    expect(ids(s)).toEqual(['a', 'b', 'y', 'c', 'd', 'z']);
    expect(current(next(s).state)).toBe('y');
    expect(current(enqueue(emptyQueue<string>(), 'x'))).toBe('x');
  });

  test('le même morceau peut apparaître deux fois', () => {
    const s = enqueue(load(), 'a');
    expect(new Set(s.order.map((e) => e.uid)).size).toBe(5);
  });

  test('suppression ajuste l’index', () => {
    let s = load(2); // c
    s = removeAt(s, 0);
    expect(current(s)).toBe('c');
    s = removeAt(s, s.index); // retire c → passe à d
    expect(current(s)).toBe('d');
    s = removeAt(s, s.index); // retire d (dernier) → b
    expect(current(s)).toBe('b');
    expect(removeAt(removeAt(s, 0), 0).index).toBe(-1);
  });

  test('saut direct', () => {
    expect(current(jumpTo(load(), 3))).toBe('d');
    expect(current(jumpTo(load(), 7))).toBe('a');
  });
});
