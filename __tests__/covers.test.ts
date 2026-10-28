import { fingerprint, pickFolderCover } from '@/library/covers';

test('image de dossier : noms reconnus, par ordre de priorité', () => {
  expect(pickFolderCover(['01.mp3', 'Folder.JPG', 'cover.png'])).toBe('cover.png');
  expect(pickFolderCover(['01.mp3', 'front.jpeg'])).toBe('front.jpeg');
  expect(pickFolderCover(['01.mp3', 'photo.jpg', 'cover.txt'])).toBeNull();
});

test('empreinte : identique pour les mêmes octets, différente sinon', () => {
  const a = Uint8Array.of(1, 2, 3, 4);
  expect(fingerprint(a)).toBe(fingerprint(Uint8Array.of(1, 2, 3, 4)));
  expect(fingerprint(a)).not.toBe(fingerprint(Uint8Array.of(1, 2, 3, 5)));
});
