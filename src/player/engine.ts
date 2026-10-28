// Pilote audio : un seul lecteur expo-audio pour toute l'application.
// Il ne connaît rien de la file d'attente : le store lui dit quoi jouer.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import type { Track } from '@/db/types';

let player: AudioPlayer | null = null;

export function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });
    // Lecture en arrière-plan + contrôles écran verrouillé (indispensable sur Android
    // pour que la musique ne s'arrête pas au bout de ~3 minutes en arrière-plan).
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((e) => console.warn('Mode audio :', e));
  }
  return player;
}

/** Infos affichées sur l'écran verrouillé et dans la notification (avec la pochette). */
function lockScreenMetadata(track: Track) {
  return {
    title: track.title,
    artist: track.artist,
    albumTitle: track.album,
    artworkUrl: track.coverUri ?? undefined, // file:// lisible par le service de lecture
  };
}

export function loadAndPlay(track: Track, autoplay = true): void {
  const p = getPlayer();
  p.replace({ uri: track.uri });
  try {
    p.setActiveForLockScreen(true, lockScreenMetadata(track));
  } catch {
    // contrôles écran verrouillé indisponibles : la lecture fonctionne quand même
  }
  if (autoplay) p.play();
}

/** Met à jour l'écran verrouillé sans relancer le morceau (ex. nouvelle pochette). */
export function refreshLockScreen(track: Track): void {
  try {
    getPlayer().updateLockScreenMetadata(lockScreenMetadata(track));
  } catch {
    // voir loadAndPlay
  }
}

export function stop(): void {
  const p = getPlayer();
  p.pause();
  try {
    p.clearLockScreenControls();
  } catch {
    // voir loadAndPlay
  }
}

export function onStatus(listener: (status: AudioStatus) => void): () => void {
  const sub = getPlayer().addListener('playbackStatusUpdate', listener);
  return () => sub.remove();
}
