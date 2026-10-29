// Trouver l'album de plusieurs titres sur MusicBrainz, puis choisir quelles propositions appliquer.
// Une requête par seconde (règle de MusicBrainz). Rien n'est modifié avant d'appuyer sur "Appliquer",
// et seulement dans la base de SCMusic (les fichiers ne sont pas touchés, "Revenir aux infos" annule).
// Chaque résultat est gardé : un titre déjà cherché n'est jamais redemandé (sauf si son titre ou artiste change).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Background } from '@/components/Screen';
import { Button, EmptyState, GlassCard, Txt } from '@/components/ui';
import { cachedAlbumLookups, editTrackInfo, saveAlbumLookup, tracksByIds, type CachedAlbumLookup } from '@/db/queries';
import type { Track } from '@/db/types';
import { findAlbumOnline, REQUEST_INTERVAL_MS, type AlbumMatch } from '@/library/musicbrainz';
import { parseIds } from '@/library/trackInfo';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, layout, radius, space } from '@/theme/tokens';
import { useT } from '@/i18n';

type Result = ({ state: 'found'; match: AlbumMatch; checked: boolean } | { state: 'none' }) & { cached?: boolean };

/** Proposition → résultat affiché. Un album identique à l'actuel n'a rien à proposer. */
function toResult(t: Track, match: AlbumMatch | CachedAlbumLookup | null, cached = false): Result {
  return match?.album && match.album !== t.album
    ? { state: 'found', match: { album: match.album, trackNo: match.trackNo, year: match.year }, checked: true, cached }
    : { state: 'none', cached };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AlbumLookup() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const params = useLocalSearchParams<{ ids: string }>();
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [results, setResults] = useState<Record<number, Result>>({});
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const idsKey = parseIds(params.ids).join(',');

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',').map(Number) : [];
    // Résultats déjà connus d'abord : ces titres ne partiront pas sur le réseau
    Promise.all([tracksByIds(ids), cachedAlbumLookups(ids)]).then(([list, cache]) => {
      const known: Record<number, Result> = {};
      for (const track of list) {
        const c = cache.get(track.id);
        if (c) known[track.id] = toResult(track, c, true);
      }
      setResults(known);
      setTracks(list);
    });
  }, [idsKey]);

  // Quitter l'écran arrête la recherche en cours
  useEffect(() => () => abort.current?.abort(), []);

  if (!tracks) return <View style={styles.root} />;

  const done = Object.keys(results).length;
  const toSearch = tracks.filter((track) => !results[track.id]).length;
  const cachedCount = tracks.filter((track) => results[track.id]?.cached).length;
  const found = tracks.filter((track) => results[track.id]?.state === 'found');
  const checked = found.filter((track) => (results[track.id] as { checked: boolean }).checked);

  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    try {
      const pending = tracks.filter((track) => !results[track.id]); // déjà cherchés : pas de nouvelle requête
      for (let i = 0; i < pending.length; i++) {
        const track = pending[i];
        if (controller.signal.aborted) break;
        let result: Result;
        try {
          const match = await findAlbumOnline(track, controller.signal);
          await saveAlbumLookup(track, match);
          result = toResult(track, match);
        } catch (e) {
          if (controller.signal.aborted) break;
          Alert.alert(t.albumLookup.interrupted, e instanceof Error ? e.message : String(e));
          break;
        }
        setResults((r) => ({ ...r, [track.id]: result }));
        if (i < pending.length - 1) await sleep(REQUEST_INTERVAL_MS);
      }
    } finally {
      setRunning(false);
      abort.current = null;
    }
  };

  const toggle = (id: number) =>
    setResults((r) => {
      const res = r[id];
      return res?.state === 'found' ? { ...r, [id]: { ...res, checked: !res.checked } } : r;
    });

  const apply = async () => {
    setApplying(true);
    try {
      for (const track of checked) {
        const { match } = results[track.id] as { match: AlbumMatch };
        // Le numéro de piste n'est ajouté que s'il manquait
        await editTrackInfo([track.id], { album: match.album, trackNo: track.trackNo == null && match.trackNo != null ? match.trackNo : undefined });
      }
      libraryChanged();
      router.back();
    } catch (e) {
      Alert.alert(t.common.error, e instanceof Error ? e.message : String(e));
      setApplying(false);
    }
  };

  const seconds = Math.ceil((toSearch * REQUEST_INTERVAL_MS) / 1000);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Background />
      <DetailHeader
        title={t.albumLookup.title}
        subtitle={running ? t.albumLookup.progress(done, tracks.length) : t.albumLookup.summary(found.length, toSearch)}
        icon="down"
      />
      <FlatList
        data={tracks}
        keyExtractor={(track) => String(track.id)}
        contentContainerStyle={{ padding: layout.gutter, gap: space.sm, paddingBottom: space.xxl }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.md }}>
            {cachedCount > 0 && (
              <Txt variant="muted">{t.albumLookup.cached(cachedCount)}</Txt>
            )}
            {!running && toSearch > 0 && (
              <GlassCard style={styles.card}>
                <Txt variant="muted">{t.albumLookup.privacy(toSearch, seconds)}</Txt>
                <Button title={done > cachedCount ? t.albumLookup.resume : t.albumLookup.start} icon="search" onPress={start} />
              </GlassCard>
            )}
            {running && <Button title={t.albumLookup.stop} kind="ghost" icon="close" onPress={() => abort.current?.abort()} />}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="disc" title={t.common.noTrack} text={t.common.tracksGone} />}
        renderItem={({ item }) => {
          const res = results[item.id];
          const on = res?.state === 'found' && res.checked;
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              disabled={res?.state !== 'found'}
              style={styles.row}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: res?.state !== 'found' }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Txt numberOfLines={1}>{item.title}</Txt>
                <Txt variant="muted" numberOfLines={1}>{item.artist} · {item.album}</Txt>
                {res?.state === 'found' ? (
                  <Txt numberOfLines={2} style={{ color: colors.accent }}>
                    → {res.match.album}
                    {res.match.trackNo && item.trackNo == null ? t.albumLookup.track(res.match.trackNo) : ''}
                    {res.match.year ? ` · ${res.match.year}` : ''}
                  </Txt>
                ) : res ? (
                  <Txt variant="muted">{t.albumLookup.nothingNew}</Txt>
                ) : null}
                {res?.cached && <Txt variant="caption">{t.albumLookup.alreadySearched}</Txt>}
              </View>
              {res?.state === 'found' && (
                <View style={[styles.check, on && styles.checkOn]}>{on && <Icon name="check" size={16} color={colors.bg} />}</View>
              )}
            </Pressable>
          );
        }}
      />
      {!running && found.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <Button
            title={applying ? t.albumLookup.applying : t.albumLookup.apply(checked.length)}
            icon="check"
            onPress={apply}
            disabled={applying || checked.length === 0}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  card: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.md },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassBorder },
});
