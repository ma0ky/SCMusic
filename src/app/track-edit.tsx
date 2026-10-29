// Modifier les infos d'un ou plusieurs titres : titre, artiste, album, numéro de piste.
// Tout est enregistré dans la base de SCMusic ; les fichiers audio ne sont jamais modifiés.
// Plusieurs titres : seuls les champs remplis sont appliqués (ex. donner le même album à une sélection).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/Header';
import { Background } from '@/components/Screen';
import { Button, EmptyState, GlassCard, Txt } from '@/components/ui';
import { albums as loadAlbums, tracksByIds } from '@/db/queries';
import type { Track } from '@/db/types';
import { commonValue, formToPatch, MAX_FIELD_LENGTH, parseIds, type TrackInfoForm } from '@/library/trackInfo';
import { normalize } from '@/search/search';
import { usePlayerStore } from '@/store/usePlayerStore';
import { colors, font, fontFamily, layout, radius, space } from '@/theme/tokens';
import { useT } from '@/i18n';

/** Nombre d'albums existants proposés sous le champ "Album". */
const MAX_SUGGESTIONS = 8;

function Field({ label, value, onChange, placeholder, numeric }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="caption">{label}</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        maxLength={numeric ? 3 : MAX_FIELD_LENGTH}
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

export default function TrackEdit() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const params = useLocalSearchParams<{ ids: string; album?: string }>();
  const { editTracks, revertTracks, renameAlbumSignal } = usePlayerStore.getState();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [albumNames, setAlbumNames] = useState<string[]>([]);
  const [form, setForm] = useState<TrackInfoForm>({ title: '', artist: '', album: '', trackNo: '' });
  const [saving, setSaving] = useState(false);
  const idsKey = parseIds(params.ids).join(',');

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',').map(Number) : [];
    tracksByIds(ids).then((list) => {
      setTracks(list);
      setForm({
        title: list.length === 1 ? list[0].title : '',
        artist: commonValue(list.map((track) => track.artist)),
        album: commonValue(list.map((track) => track.album)),
        trackNo: list.length === 1 && list[0].trackNo ? String(list[0].trackNo) : '',
      });
    });
    loadAlbums().then((a) => setAlbumNames(a.map((x) => x.album)));
  }, [idsKey]);

  if (!tracks) return <View style={styles.root} />;
  if (!tracks.length) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Background />
        <DetailHeader title={t.trackEdit.title} icon="down" />
        <EmptyState icon="edit" title={t.common.noTrack} text={t.common.tracksGone} />
      </View>
    );
  }

  // Depuis un album : édition groupée, même s'il ne contient qu'un titre
  const multiple = tracks.length > 1 || !!params.album;
  const ids = tracks.map((track) => track.id);
  const set = (key: keyof TrackInfoForm) => (v: string) => setForm({ ...form, [key]: v });
  const typed = normalize(form.album);
  const suggestions = albumNames
    .filter((a) => a !== form.album && (!typed || normalize(a).includes(typed)))
    .slice(0, MAX_SUGGESTIONS);

  const save = async () => {
    const result = formToPatch(form, multiple);
    if (!result.ok) {
      Alert.alert(t.trackEdit.cantSave, result.error);
      return;
    }
    setSaving(true);
    try {
      await editTracks(ids, result.patch);
      // Ouvert depuis un album que l'on renomme : l'écran de l'album suit le nouveau nom
      if (params.album && result.patch.album && result.patch.album !== params.album) renameAlbumSignal(params.album, result.patch.album);
      router.back();
    } catch (e) {
      Alert.alert(t.common.error, e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const revert = () =>
    Alert.alert(t.trackEdit.revertConfirm, t.trackEdit.revertText, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.trackEdit.revertButton, style: 'destructive', onPress: () => revertTracks(ids).then(() => router.back()) },
    ]);

  const anyEdited = tracks.some((track) => track.edited);
  const title = params.album ? t.trackEdit.titleAlbum : multiple ? t.trackEdit.titleMany(tracks.length) : t.trackEdit.titleOne;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Background />
        <DetailHeader title={title} subtitle={multiple ? t.trackEdit.emptyKeeps : tracks[0].filename} icon="down" />
        <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
          {!multiple && <Field label={t.trackEdit.fieldTitle} value={form.title} onChange={set('title')} />}
          <Field label={t.trackEdit.fieldArtist} value={form.artist} onChange={set('artist')} placeholder={multiple ? t.trackEdit.manyArtists : t.trackEdit.unknownArtist} />
          <Field label={t.trackEdit.fieldAlbum} value={form.album} onChange={set('album')} placeholder={multiple ? t.trackEdit.manyAlbums : t.trackEdit.albumHint} />
          {suggestions.length > 0 && (
            <View style={styles.chips}>
              {suggestions.map((a) => (
                <Pressable key={a} onPress={() => set('album')(a)} style={styles.chip} accessibilityRole="button" accessibilityLabel={t.trackEdit.chooseAlbum(a)}>
                  <Txt numberOfLines={1} style={styles.chipText}>{a}</Txt>
                </Pressable>
              ))}
            </View>
          )}
          {!params.album && (
            <Field label={t.trackEdit.fieldTrackNo} value={form.trackNo} onChange={set('trackNo')} placeholder={multiple ? t.trackEdit.unchanged : t.trackEdit.noNumber} numeric />
          )}

          <Button title={saving ? t.common.saving : t.common.save} icon="edit" onPress={save} disabled={saving} />

          <GlassCard style={styles.note}>
            <Txt variant="muted">{t.trackEdit.note}</Txt>
          </GlassCard>

          {anyEdited && <Button title={t.trackEdit.revert} kind="danger" onPress={revert} disabled={saving} />}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  form: { padding: layout.gutter, gap: space.lg },
  input: {
    fontFamily,
    fontSize: font.md,
    color: colors.text,
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.sm },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  chipText: { fontSize: font.sm, color: colors.text },
  note: { padding: space.md },
});
