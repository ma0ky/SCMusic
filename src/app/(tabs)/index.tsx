// Accueil : écoutés récemment, ajoutés récemment, accès aux titres aimés et aux statistiques.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PageTitle } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TrackMenu } from '@/components/Sheet';
import { TrackRow } from '@/components/TrackRow';
import { Button, EmptyState, GlassCard, IconButton, SectionTitle, Txt } from '@/components/ui';
import { likedTracks, recentlyAdded, recentTracks } from '@/db/queries';
import type { Track } from '@/db/types';
import { useLibrary } from '@/store/useLibrary';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, layout, space } from '@/theme/tokens';

function Logo() {
  return (
    <Svg width={28} height={28} viewBox="0 0 512 512">
      <Path d="M336 168 A88 88 0 1 0 256 256 A88 88 0 1 1 176 344" fill="none" stroke={colors.accent} strokeWidth={56} strokeLinecap="round" />
    </Svg>
  );
}

export default function Home() {
  const playTracks = usePlayerStore((s) => s.playTracks);
  const [menuFor, setMenuFor] = useState<Track | null>(null);
  const { data, loading } = useLibrary(
    async () => ({ recent: await recentTracks(10), added: await recentlyAdded(10), liked: await likedTracks() }),
    { recent: [] as Track[], added: [] as Track[], liked: [] as Track[] },
  );

  const section = (title: string, list: Track[]) =>
    list.length > 0 && (
      <>
        <SectionTitle>{title}</SectionTitle>
        {list.map((t, i) => (
          <TrackRow key={t.id} track={t} onPress={() => playTracks(list, i)} onMore={() => setMenuFor(t)} />
        ))}
      </>
    );

  return (
    <Screen>
      <PageTitle
        title="SCMusic"
        right={
          <>
            <IconButton name="stats" label="Statistiques d'écoute" onPress={() => router.push('/stats')} />
            <IconButton name="settings" label="Réglages" onPress={() => router.push('/settings')} />
          </>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: layout.contentBottom }}>
        {!loading && data.added.length === 0 ? (
          <GlassCard style={{ marginTop: space.xl }}>
            <EmptyState icon="folder" title="Bienvenue sur SCMusic" text="Choisis le dossier qui contient tes MP3 et FLAC pour construire ta bibliothèque.">
              <Button title="Choisir mon dossier musique" icon="folder" onPress={() => router.push('/settings')} />
            </EmptyState>
          </GlassCard>
        ) : (
          <>
            <Pressable onPress={() => data.liked.length > 0 && playTracks(data.liked)}>
              <GlassCard style={styles.likedCard}>
                <View style={styles.likedIcon}>
                  <Icon name="heartFill" size={26} color={colors.liked} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">Titres aimés</Txt>
                  <Txt variant="muted">{data.liked.length} morceau{data.liked.length > 1 ? 'x' : ''}</Txt>
                </View>
                <Logo />
              </GlassCard>
            </Pressable>
            {section('Écoutés récemment', data.recent)}
            {section('Ajoutés récemment', data.added)}
          </>
        )}
      </ScrollView>
      <TrackMenu track={menuFor} onClose={() => setMenuFor(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  likedCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, marginTop: space.sm },
  likedIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
