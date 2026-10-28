import { cleanTag, id3TagSize, parseFlac, parseId3, parseTags, parseTrackNo, tagsFromFilename } from '@/library/tags';

// ---- Petits constructeurs de fichiers de test ----

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const be32 = (n: number) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const le32 = (n: number) => Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);
const synch = (n: number) => Uint8Array.of((n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127);

function id3v23(frames: [string, Uint8Array][]): Uint8Array {
  const body = concat(...frames.map(([id, data]) => concat(latin1(id), be32(data.length), Uint8Array.of(0, 0), data)));
  const padded = concat(body, new Uint8Array(20)); // padding comme dans les vrais fichiers
  return concat(latin1('ID3'), Uint8Array.of(3, 0, 0), synch(padded.length), padded);
}
const textLatin1 = (s: string) => concat(Uint8Array.of(0), latin1(s));
const textUtf16 = (s: string) => {
  const b = [0xff, 0xfe];
  for (const c of s) { const code = c.charCodeAt(0); b.push(code & 255, code >> 8); }
  return concat(Uint8Array.of(1), Uint8Array.from(b));
};

// Fausse image JPEG (en-tête FF D8 + remplissage) pour les tests de pochette
const fakeJpeg = concat(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0), new Uint8Array(100).fill(7));
const fakePng = concat(Uint8Array.of(0x89, 0x50, 0x4e, 0x47), new Uint8Array(100).fill(9));

function apic(type: number, img: Uint8Array, mime = 'image/jpeg') {
  return concat(Uint8Array.of(0), latin1(mime), Uint8Array.of(0, type), latin1('desc'), Uint8Array.of(0), img);
}

function flacPicture(type: number, img: Uint8Array, mime: string) {
  return concat(be32(type), be32(mime.length), latin1(mime), be32(0), be32(500), be32(500), be32(24), be32(0), be32(img.length), img);
}

function flac(comments: string[], sampleRate = 44100, samples = 44100 * 185, picture?: Uint8Array): Uint8Array {
  const si = new Uint8Array(34);
  si[10] = (sampleRate >> 12) & 255;
  si[11] = (sampleRate >> 4) & 255;
  si[12] = (sampleRate & 15) << 4;
  si.set(be32(samples), 14);
  const enc = new TextEncoder();
  const vc = concat(le32(3), latin1('xyz'), le32(comments.length), ...comments.map((c) => concat(le32(enc.encode(c).length), enc.encode(c))));
  const header = (last: boolean, type: number, len: number) =>
    Uint8Array.of((last ? 0x80 : 0) | type, (len >> 16) & 255, (len >> 8) & 255, len & 255);
  if (!picture) return concat(latin1('fLaC'), header(false, 0, 34), si, header(true, 4, vc.length), vc);
  return concat(latin1('fLaC'), header(false, 0, 34), si, header(false, 4, vc.length), vc, header(true, 6, picture.length), picture);
}

// ---- Tests ----

describe('nettoyage', () => {
  test('cleanTag', () => {
    expect(cleanTag('  Hello\u0000  World ')).toBe('Hello World');
    expect(cleanTag('   ')).toBeUndefined();
    expect(cleanTag(undefined)).toBeUndefined();
  });
  test('parseTrackNo', () => {
    expect(parseTrackNo('3/12')).toBe(3);
    expect(parseTrackNo('07')).toBe(7);
    expect(parseTrackNo('abc')).toBeUndefined();
  });
  test('nom de fichier', () => {
    expect(tagsFromFilename('01 - Artiste - Mon titre.mp3')).toEqual({ trackNo: 1, artist: 'Artiste', title: 'Mon titre' });
    expect(tagsFromFilename('05. Intro.flac')).toEqual({ trackNo: 5, title: 'Intro' });
    expect(tagsFromFilename('morceau_sans_info.mp3')).toEqual({ title: 'morceau sans info', trackNo: undefined });
  });
});

describe('ID3v2', () => {
  const tag = id3v23([
    ['TIT2', textUtf16('Été indien')],
    ['TPE1', textLatin1('Le Groupe ')],
    ['TALB', textLatin1('Premier album')],
    ['TRCK', textLatin1('4/10')],
  ]);
  test('taille du tag', () => expect(id3TagSize(tag)).toBe(tag.length));
  test('lit titre UTF-16, artiste, album, numéro', () => {
    expect(parseId3(tag)).toEqual({ title: 'Été indien', artist: 'Le Groupe', album: 'Premier album', trackNo: 4 });
  });
  test('fichier sans tag', () => expect(parseId3(latin1('pas un mp3'))).toEqual({}));
});

describe('FLAC', () => {
  test('lit commentaires et durée', () => {
    const f = flac(['TITLE=Nocturne', 'artist=Pianiste', 'ALBUM=Nuits', 'TRACKNUMBER=2']);
    expect(parseFlac(f)).toEqual({ title: 'Nocturne', artist: 'Pianiste', album: 'Nuits', trackNo: 2, duration: 185 });
  });
});

describe('parseTags', () => {
  test('repli sur le nom de fichier puis valeurs par défaut', () => {
    expect(parseTags(latin1('xx'), 'Artiste X - Chanson.mp3')).toMatchObject({
      title: 'Chanson', artist: 'Artiste X', album: 'Album inconnu',
    });
  });
});

describe('pochettes intégrées', () => {
  test('ID3 : préfère la couverture avant (type 3)', () => {
    const tag = id3v23([
      ['TIT2', textLatin1('Titre')],
      ['APIC', apic(4, fakePng, 'image/png')], // dos de pochette
      ['APIC', apic(3, fakeJpeg)], // couverture avant
    ]);
    const { picture } = parseId3(tag);
    expect(picture?.mime).toBe('image/jpeg');
    expect(picture?.data).toEqual(fakeJpeg);
  });

  test('ID3 : prend la seule image disponible, type détecté par les octets', () => {
    const { picture } = parseId3(id3v23([['APIC', apic(0, fakePng, 'image/jpeg')]]));
    expect(picture?.mime).toBe('image/png');
  });

  test('FLAC : bloc PICTURE', () => {
    const f = flac(['TITLE=X'], 44100, 44100, flacPicture(3, fakeJpeg, 'image/jpeg'));
    const tags = parseFlac(f);
    expect(tags.title).toBe('X');
    expect(tags.picture?.data).toEqual(fakeJpeg);
  });

  test('pas d’image → pas de pochette', () => {
    expect(parseId3(id3v23([['TIT2', textLatin1('X')]])).picture).toBeUndefined();
  });
});
