import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { repository } from '../repository';
import { dedupeCategories, migrateCategories } from '../repository/db';
import type { Car, Category, Settings, User } from '../entities/types';

interface StoreValue {
  user: User | undefined;
  /** Есть ли вообще профили: от этого зависит, что показать — вход или регистрацию. */
  hasUsers: boolean;
  cars: Car[];
  categories: Category[];
  settings: Settings | undefined;
  activeCar: Car | undefined;
  loading: boolean;
  /** Идёт фоновое обновление: экран не прячем, только слегка притушим. */
  refreshing: boolean;
  /** Счётчик изменений: страницы подписываются на него, чтобы перечитать записи. */
  revision: number;
  setActiveCar: (carId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [user, setUser] = useState<User>();
  const [hasUsers, setHasUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (revision > 0) setRefreshing(true);
      // Разовая чистка: в ранних сборках гонка при первом запуске плодила дубликаты категорий.
      await dedupeCategories();
      await migrateCategories();
      const loadedSettings = await repository.settings.get();
      const [usersCount, currentUser] = await Promise.all([
        repository.users.count(),
        loadedSettings.currentUserId
          ? repository.users.get(loadedSettings.currentUserId)
          : Promise.resolve(undefined),
      ]);
      const [loadedCars, loadedCategories] = await Promise.all([
        repository.cars.list(false, currentUser?.id),
        repository.categories.list(true),
      ]);
      if (cancelled) return;
      setHasUsers(usersCount > 0);
      setUser(currentUser);
      setSettings(loadedSettings);
      setCars(loadedCars);
      setCategories(loadedCategories);
      setLoading(false);
      setRefreshing(false);
    })();
    return () => { cancelled = true; };
  }, [revision]);

  const activeCar = useMemo(
    () => cars.find((c) => c.id === settings?.activeCarId) ?? cars[0],
    [cars, settings?.activeCarId],
  );

  const signOut = useCallback(async () => {
    await repository.settings.update({ currentUserId: undefined });
    setUser(undefined);
    refresh();
  }, [refresh]);

  const setActiveCar = useCallback(async (carId: string) => {
    const next = await repository.settings.update({ activeCarId: carId });
    setSettings(next);
  }, []);

  const value: StoreValue = {
    user, hasUsers, cars, categories, settings, activeCar,
    loading, refreshing, revision, setActiveCar, signOut, refresh,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore вызван вне StoreProvider');
  return ctx;
}
