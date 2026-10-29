// Langue enregistrée dans les réglages (séparé de index.ts pour que les tests n'aient pas besoin de la base).
import { getSetting, setSetting } from '@/db/queries';
import { applyLang, isLang, type Lang } from './index';

const KEY = 'language';

export async function loadLanguage(): Promise<void> {
  const saved = await getSetting(KEY);
  if (isLang(saved)) applyLang(saved);
}

export async function saveLanguage(lang: Lang): Promise<void> {
  applyLang(lang);
  await setSetting(KEY, lang);
}
