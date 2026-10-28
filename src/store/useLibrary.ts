// Petit hook de chargement : relance la requête quand la bibliothèque change
// (scan, "j'aime", playlist modifiée…) ou quand ses dépendances changent.
import { useEffect, useState } from 'react';
import { usePlayerStore } from './usePlayerStore';

export function useLibrary<T>(load: () => Promise<T>, initial: T, deps: unknown[] = []): { data: T; loading: boolean } {
  const version = usePlayerStore((s) => s.libraryVersion);
  const key = JSON.stringify([version, ...deps]);
  // `key` mémorise pour quelle requête les données ont été chargées
  const [result, setResult] = useState<{ key: string | null; data: T }>({ key: null, data: initial });

  useEffect(() => {
    let alive = true;
    load()
      .then((data) => alive && setResult({ key, data }))
      .catch((e) => console.warn('Chargement impossible :', e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: result.data, loading: result.key !== key };
}
