import { useEffect, useRef, useState } from 'react';

/**
 * Асинхронное чтение с защитой от гонок.
 *
 * Предыдущие данные не сбрасываются на время новой загрузки: иначе экран
 * мигает пустотой при каждом изменении зависимостей. `loading` относится
 * только к первой загрузке, для фоновых есть `refreshing`.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error>();
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (loaded.current) setRefreshing(true);

    loader()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(undefined);
        loaded.current = true;
      })
      .catch((e: Error) => { if (!cancelled) setError(e); })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading: loading && !loaded.current, refreshing, error };
}
