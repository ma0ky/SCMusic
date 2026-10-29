import { checkCover, fingerprint, imageSize, pickFolderCover, pickSidecarCover } from '@/library/covers';

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

const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
// JPEG : SOI, un segment APP0 à sauter, puis SOF0 (hauteur 300, largeur 400)
const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0xff, 0xc0, 0, 11, 8, 0x01, 0x2c, 0x01, 0x90, 3, 0, 0, 0);

test('dimensions lues dans l’en-tête PNG et JPEG', () => {
  expect(imageSize(png(640, 480))).toEqual({ width: 640, height: 480 });
  expect(imageSize(jpeg)).toEqual({ width: 400, height: 300 });
  expect(imageSize(Uint8Array.of(1, 2, 3))).toBeNull();
});

test('pochette refusée si trop grande ou illisible (pixel flood)', () => {
  expect(() => checkCover(png(3000, 3000))).not.toThrow();
  expect(() => checkCover(png(100_000, 100_000))).toThrow('trop grande');
  expect(() => checkCover(Uint8Array.of(0, 1, 2, 3))).toThrow('pas une image');
});
