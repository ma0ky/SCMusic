// Langue de l'interface (français ou anglais), choisie dans les réglages.
// Écrans : `const t = useT()` (se redessinent quand la langue change). Ailleurs (erreurs, formats) : `tr()`.
// Les données (titres, noms d'album, "Artiste inconnu" des fichiers sans tags) ne sont pas traduites.
import { create } from 'zustand';
import { en } from './en';
import { fr, type Messages } from './fr';

export type Lang = 'fr' | 'en';
export const LANGS: { value: Lang; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

const MESSAGES: Record<Lang, Messages> = { fr, en };

const useLangStore = create<{ lang: Lang }>(() => ({ lang: 'fr' }));

export const isLang = (v: unknown): v is Lang => v === 'fr' || v === 'en';
export const useLang = (): Lang => useLangStore((s) => s.lang);
export const useT = (): Messages => MESSAGES[useLang()];
export const tr = (): Messages => MESSAGES[useLangStore.getState().lang];
export const applyLang = (lang: Lang) => useLangStore.setState({ lang });
