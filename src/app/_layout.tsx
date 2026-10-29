// Racine de l'app : prépare la base de données, déclare la pile d'écrans et propose les mises à jour.
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { migrate } from '@/db/schema';
import { Txt } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { UpdateProgress, useUpdater } from '@/update/useUpdater';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updater = useUpdater();

  useEffect(() => {
    migrate().then(() => setReady(true)).catch((e) => setError(String(e)));
  }, []);

  // Une fois la base prête : nouvelle version publiée ? (au plus une fois par jour)
  const { check } = updater;
  useEffect(() => {
    if (ready) check();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {error ? <Txt style={{ color: colors.danger }}>Erreur base de données : {error}</Txt> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="queue" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="lyrics-edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="track-edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="album-lookup" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <UpdateProgress progress={updater.progress} />
    </>
  );
}
