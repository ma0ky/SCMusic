import { fingerprint, pickFolderCover, pickSidecarCover } from '@/library/covers';

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

test('image du même nom que le morceau', () => {
  const files = ['Ma Chanson.mp3', 'ma chanson.PNG', 'Autre.mp3', 'cover.jpg'];
  expect(pickSidecarCover('Ma Chanson.mp3', files)).toBe('ma chanson.PNG');
  expect(pickSidecarCover('Autre.mp3', files)).toBeNull();
  expect(pickSidecarCover('Live.flac', ['Live.flac', 'Live.jpg'])).toBe('Live.jpg');
});
