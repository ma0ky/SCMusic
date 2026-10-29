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
import { useLang, useT } from '@/i18n';

const PERIODS: Period[] = ['week', 'month', 'year', 'all'];

/** "Oublié" = plus écouté depuis 60 jours. */
const FORGOTTEN_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

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
  const t = useT();
  return (
    <View style={styles.segments}>
      {PERIODS.map((p) => {
        const on = p === value;
        return (
          <Pressable key={p} onPress={() => onChange(p)} style={[styles.segment, on && styles.segmentOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Txt style={{ color: on ? colors.bg : colors.textMuted, fontWeight: '700', fontSize: 13 }}>{t.stats.periods[p]}</Txt>
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
  const t = useT();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.group, pressed && { backgroundColor: colors.glass }]}>
      <Rank n={rank} />
      <Cover uri={group.coverUri} size={44} />
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1}>{group.name}</Txt>
        <Txt variant="muted" numberOfLines={1}>{t.common.plays(group.plays)} · {formatListening(group.seconds)}</Txt>
      </View>
    </Pressable>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const playTracks = usePlayerStore((s) => s.playTracks);
  const libraryChanged = usePlayerStore((s) => s.libraryChanged);
  const [period, setPeriod] = useState<Period>('week');
  const { data, loading } = useLibrary<Stats | null>(() => loadStats(period), null, [period, lang]); // libellés des dates dans la langue choisie

  const playList = (list: TopTrack[], i: number) => playTracks(list.map((top) => top.track), i);
  const shuffled = (list: Track[]) => [...list].sort(() => Math.random() - 0.5);

  const reset = () =>
    Alert.alert(t.stats.clearConfirm, t.stats.clearText, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.stats.clearButton, style: 'destructive', onPress: () => clearPlays().then(libraryChanged) },
    ]);

  const body = () => {
    if (!data) return null;
    const { buckets, totals, values, tracks, artists, albums, forgotten, never } = data;

    return (
      <>
        <View style={styles.tiles}>
          <Tile value={formatListening(totals.seconds)} label={t.stats.listened} />
          <Tile value={String(totals.plays)} label={t.stats.playsLabel(totals.plays)} />
        </View>
        <View style={styles.tiles}>
          <Tile value={String(totals.tracks)} label={t.stats.tracksLabel(totals.tracks)} />
          <Tile value={String(totals.artists)} label={t.stats.artistsLabel(totals.artists)} />
        </View>

        {totals.plays === 0 ? (
          <GlassCard style={{ marginTop: space.lg }}>
            <EmptyState icon="stats" title={t.stats.noPlays} text={t.stats.noPlaysText(COUNT_AFTER)} />
          </GlassCard>
        ) : (
          <>
            <SectionTitle>{buckets.unit === 'day' ? t.stats.timePerDay : t.stats.timePerMonth}</SectionTitle>
            <GlassCard style={styles.card}>
              <BarChart
                key={period}
                values={values}
                labels={buckets.labels}
                describe={(i) => `${longLabel(buckets.keys[i])} · ${formatListening(values[i])}`}
              />
            </GlassCard>

            <SectionTitle>{t.stats.topTracks}</SectionTitle>
            {tracks.map((top, i) => (
              <View key={top.track.id} style={styles.ranked}>
                <Rank n={i + 1} />
                <View style={{ flex: 1 }}>
                  <TrackRow track={top.track} onPress={() => playList(tracks, i)} subtitle={`${top.track.artist} · ${t.common.plays(top.plays)}`} />
                </View>
              </View>
            ))}

            <SectionTitle>{t.stats.topArtists}</SectionTitle>
            {artists.map((a, i) => (
              <GroupRow key={a.name} rank={i + 1} group={a} onPress={() => router.push({ pathname: '/artist/[id]', params: { id: a.name } })} />
            ))}

            <SectionTitle>{t.stats.topAlbums}</SectionTitle>
            {albums.map((a, i) => (
              <GroupRow key={a.name} rank={i + 1} group={a} onPress={() => router.push({ pathname: '/album/[id]', params: { id: a.name } })} />
            ))}
          </>
        )}

        {forgotten.length > 0 && (
          <>
            <SectionTitle>{t.stats.forgotten}</SectionTitle>
            <Txt variant="muted" style={styles.hint}>{t.stats.forgottenText}</Txt>
            {forgotten.map((top, i) => (
              <TrackRow key={top.track.id} track={top.track} onPress={() => playList(forgotten, i)} subtitle={`${top.track.artist} · ${t.common.plays(top.plays)}`} />
            ))}
          </>
        )}

        {never.length > 0 && (
          <>
            <SectionTitle>{t.stats.never}</SectionTitle>
            <GlassCard style={styles.card}>
              <Txt>{t.stats.neverText(never.length)}</Txt>
              <Button title={t.stats.neverPlay} icon="shuffle" onPress={() => playTracks(shuffled(never))} />
            </GlassCard>
          </>
        )}

        <View style={{ marginTop: space.xxl, gap: space.md }}>
          <Txt variant="muted">{t.stats.footer(COUNT_AFTER)}</Txt>
          <Button title={t.stats.clear} kind="danger" icon="trash" onPress={reset} />
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Background />
      <DetailHeader title={t.stats.title} subtitle={loading ? t.stats.computing : undefined} />
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
