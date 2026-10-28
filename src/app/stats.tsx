// Statistiques d'écoute, calculées sur le téléphone : temps d'écoute, tops, titres oubliés ou jamais écoutés.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from '@/components/BarChart';
import { Cover } from '@/components/Cover';
import { DetailHeader } from '@/components/Header';
import { Background } from '@/components/Screen';
import { TrackRow } from '@/components/TrackRow';
import { Button, EmptyState, GlassCard, SectionTitle, Txt } from '@/components/ui';
import {
  clearPlays, forgottenTracks, listeningByPeriod, listeningTotals, neverPlayedTracks, topAlbums, topArtists, topTracks,
  type TopGroup, type TopTrack,
} from '@/db/queries';
import type { Track } from '@/db/types';
import { bucketsFor, COUNT_AFTER, fillBuckets, formatListening, longLabel, type Period } from '@/stats/listening';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, font, layout, radius, space } from '@/theme/tokens';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: '7 jours' },
  { key: 'month', label: '30 jours' },
  { key: 'year', label: '12 mois' },
  { key: 'all', label: 'Toujours' },
];

/** "Oublié" = plus écouté depuis 60 jours. */
const FORGOTTEN_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

async function loadStats(period: Period) {
  const now = new Date();
  const firstPlay = (await listeningTotals(0)).firstPlay;
  const buckets = bucketsFor(period, now, firstPlay);
  const [totals, rows, tracks, artists, albums, forgotten, never] = await Promise.all([
    listeningTotals(buckets.since),
    listeningByPeriod(buckets.since, buckets.unit),
    topTracks(buckets.since),
    topArtists(buckets.since),
    topAlbums(buckets.since),
    forgottenTracks(now.getTime() - FORGOTTEN_AFTER_MS),
    neverPlayedTracks(),
  ]);
  return { buckets, totals, values: fillBuckets(buckets.keys, rows), tracks, artists, albums, forgotten, never };
}

type Stats = Awaited<ReturnType<typeof loadStats>>;

function Segments({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <View style={styles.segments}>
      {PERIODS.map((p) => {
        const on = p.key === value;
        return (
          <Pressable key={p.key} onPress={() => onChange(p.key)} style={[styles.segment, on && styles.segmentOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Txt style={{ color: on ? colors.bg : colors.textMuted, fontWeight: '700', fontSize: 13 }}>{p.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <GlassCard style={styles.tile}>
      <Txt style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
      <Txt variant="muted">{label}</Txt>
    </GlassCard>
  );
}

function Rank({ n }: { n: number }) {
  return <Txt style={styles.rank}>{n}</Txt>;
}

function GroupRow({ rank, group, onPress }: { rank: number; group: TopGroup; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.group, pressed && { backgroundColor: colors.glass }]}>
      <Rank n={rank} />
      <Cover uri={group.coverUri} size={44} />
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1}>{group.name}</Txt>
        <Txt variant="muted" numberOfLines={1}>{plural(group.plays, 'écoute')} · {formatListening(group.seconds)}</Txt>
      </View>
    </Pressable>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const playTracks = usePlayerStore((s) => s.playTracks);
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const [period, setPeriod] = useState<Period>('week');
  const { data, loading } = useLibrary<Stats | null>(() => loadStats(period), null, [period]);

  const playList = (list: TopTrack[], i: number) => playTracks(list.map((t) => t.track), i);
  const shuffled = (list: Track[]) => [...list].sort(() => Math.random() - 0.5);

  const reset = () =>
    Alert.alert('Effacer l’historique ?', 'Toutes tes statistiques d’écoute seront supprimées. Tes titres et playlists restent.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: () => clearPlays().then(libraryChanged) },
    ]);

  const body = () => {
    if (!data) return null;
    const { buckets, totals, values, tracks, artists, albums, forgotten, never } = data;
    const unitWord = buckets.unit === 'day' ? 'par jour' : 'par mois';

    return (
      <>
        <View style={styles.tiles}>
          <Tile value={formatListening(totals.seconds)} label="d’écoute" />
          <Tile value={String(totals.plays)} label={totals.plays > 1 ? 'écoutes' : 'écoute'} />
        </View>
        <View style={styles.tiles}>
          <Tile value={String(totals.tracks)} label={totals.tracks > 1 ? 'titres différents' : 'titre différent'} />
          <Tile value={String(totals.artists)} label={totals.artists > 1 ? 'artistes' : 'artiste'} />
        </View>

        {totals.plays === 0 ? (
          <GlassCard style={{ marginTop: space.lg }}>
            <EmptyState icon="stats" title="Pas encore d’écoute" text={`Rien sur cette période. Un titre compte comme écouté après ${COUNT_AFTER} secondes.`} />
          </GlassCard>
        ) : (
          <>
            <SectionTitle>Temps d’écoute {unitWord}</SectionTitle>
            <GlassCard style={styles.card}>
              <BarChart
                key={period}
                values={values}
                labels={buckets.labels}
                describe={(i) => `${longLabel(buckets.keys[i])} · ${formatListening(values[i])}`}
              />
            </GlassCard>

            <SectionTitle>Titres les plus écoutés</SectionTitle>
            {tracks.map((t, i) => (
              <View key={t.track.id} style={styles.ranked}>
                <Rank n={i + 1} />
                <View style={{ flex: 1 }}>
                  <TrackRow track={t.track} onPress={() => playList(tracks, i)} subtitle={`${t.track.artist} · ${plural(t.plays, 'écoute')}`} />
                </View>
              </View>
            ))}

            <SectionTitle>Artistes les plus écoutés</SectionTitle>
            {artists.map((a, i) => (
              <GroupRow key={a.name} rank={i + 1} group={a} onPress={() => router.push({ pathname: '/artist/[id]', params: { id: a.name } })} />
            ))}

            <SectionTitle>Albums les plus écoutés</SectionTitle>
            {albums.map((a, i) => (
              <GroupRow key={a.name} rank={i + 1} group={a} onPress={() => router.push({ pathname: '/album/[id]', params: { id: a.name } })} />
            ))}
          </>
        )}

        {forgotten.length > 0 && (
          <>
            <SectionTitle>À redécouvrir</SectionTitle>
            <Txt variant="muted" style={styles.hint}>Tu les écoutais souvent, mais plus depuis deux mois.</Txt>
            {forgotten.map((t, i) => (
              <TrackRow key={t.track.id} track={t.track} onPress={() => playList(forgotten, i)} subtitle={`${t.track.artist} · ${plural(t.plays, 'écoute')}`} />
            ))}
          </>
        )}

        {never.length > 0 && (
          <>
            <SectionTitle>Jamais écoutés</SectionTitle>
            <GlassCard style={styles.card}>
              <Txt>{plural(never.length, 'titre')} de ta bibliothèque {never.length > 1 ? 'n’ont' : 'n’a'} jamais été écouté{never.length > 1 ? 's' : ''}.</Txt>
              <Button title="Les écouter en aléatoire" icon="shuffle" onPress={() => playTracks(shuffled(never))} />
            </GlassCard>
          </>
        )}

        <View style={{ marginTop: space.xxl, gap: space.md }}>
          <Txt variant="muted">Calculées sur ton téléphone, jamais envoyées. Un titre compte après {COUNT_AFTER} s d’écoute (sauts dans le morceau non comptés).</Txt>
          <Button title="Effacer l’historique d’écoute" kind="danger" icon="trash" onPress={reset} />
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Background />
      <DetailHeader title="Statistiques" subtitle={loading ? 'Calcul…' : undefined} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: insets.bottom + space.xxl }}>
        <Segments value={period} onChange={setPeriod} />
        {body()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    marginBottom: space.md,
    padding: space.xs,
    gap: space.xs,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.accent },
  tiles: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  tile: { flex: 1, padding: space.lg, gap: space.xs },
  tileValue: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  card: { padding: space.lg, gap: space.md },
  ranked: { flexDirection: 'row', alignItems: 'center' },
  rank: { width: 24, textAlign: 'center', color: colors.textMuted, fontWeight: '700' },
  group: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.rowHeight, paddingHorizontal: space.sm, borderRadius: radius.md },
  hint: { marginBottom: space.sm },
});
