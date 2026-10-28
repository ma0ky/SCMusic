import { insertPlay, updatePlay } from '@/db/queries';
import { endListening, onListeningStatus, startListening } from '@/stats/tracker';
import type { Track } from '@/db/types';

jest.mock('@/db/queries', () => ({ insertPlay: jest.fn(async () => 42), updatePlay: jest.fn(async () => {}) }));

const track = { id: 7, duration: 200 } as Track;
const status = (currentTime: number, playing = true) =>
  ({ isLoaded: true, currentTime, playing, duration: 200 }) as Parameters<typeof onListeningStatus>[0];
const flush = () => new Promise((r) => setTimeout(r, 0));

test('une écoute est écrite à 30 s, mise à jour puis clôturée', async () => {
  let now = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  startListening(track);
  for (let t = 0; t <= 50; t += 0.25) {
    now = t * 1000;
    onListeningStatus(status(t));
  }
  endListening();
  await flush();
  await flush();

  expect(insertPlay).toHaveBeenCalledTimes(1);
  expect(insertPlay).toHaveBeenCalledWith(7, 0, 30, false);
  expect(updatePlay).toHaveBeenLastCalledWith(42, 50, false);
});

test('moins de 30 s : rien n’est enregistré', async () => {
  jest.mocked(insertPlay).mockClear();
  let now = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  startListening(track);
  for (let t = 0; t <= 20; t += 0.25) {
    now = t * 1000;
    onListeningStatus(status(t));
  }
  endListening();
  await flush();
  expect(insertPlay).not.toHaveBeenCalled();
});
