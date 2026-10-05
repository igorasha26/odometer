import type {
  Car, Category, Entry, Reminder, Settings, User,
  NewCar, NewCategory, NewEntry, NewReminder, UUID, ISODate,
} from '../entities/types';

export interface EntryFilter {
  carId?: UUID;
  categoryIds?: UUID[];
  from?: ISODate;
  to?: ISODate;
  search?: string;
}

/**
 * Единственная точка доступа к данным.
 * Приложение не знает, что за реализацией — IndexedDB или HTTP-запрос к серверу.
 * Всё асинхронное, даже локальное: иначе переезд на сервер сломает каждый вызов.
 */
export interface Repository {
  users: {
    /** Есть ли вообще учётные записи — от этого зависит первый экран. */
    count(): Promise<number>;
    findByEmail(email: string): Promise<User | undefined>;
    get(id: UUID): Promise<User | undefined>;
    create(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
    update(id: UUID, patch: Partial<User>): Promise<User>;
  };
  cars: {
    /** Только машины текущего владельца, если он передан. */
    list(includeArchived?: boolean, userId?: UUID): Promise<Car[]>;
    get(id: UUID): Promise<Car | undefined>;
    create(car: NewCar): Promise<Car>;
    update(id: UUID, patch: Partial<Car>): Promise<Car>;
    remove(id: UUID): Promise<void>;
  };
  categories: {
    list(includeHidden?: boolean): Promise<Category[]>;
    create(category: NewCategory): Promise<Category>;
    update(id: UUID, patch: Partial<Category>): Promise<Category>;
    remove(id: UUID): Promise<void>;
  };
  entries: {
    list(filter?: EntryFilter): Promise<Entry[]>;
    get(id: UUID): Promise<Entry | undefined>;
    create(entry: NewEntry): Promise<Entry>;
    update(id: UUID, patch: Partial<Entry>): Promise<Entry>;
    remove(id: UUID): Promise<void>;
    /** Последняя по пробегу запись — чтобы подставить одометр в форму. */
    lastOdometer(carId: UUID): Promise<number | undefined>;
  };
  reminders: {
    list(carId?: UUID): Promise<Reminder[]>;
    create(reminder: NewReminder): Promise<Reminder>;
    update(id: UUID, patch: Partial<Reminder>): Promise<Reminder>;
    remove(id: UUID): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: Partial<Settings>): Promise<Settings>;
  };
  backup: {
    export(): Promise<BackupFile>;
    import(data: BackupFile, mode: 'replace' | 'merge'): Promise<void>;
  };
}

export interface BackupFile {
  version: 1;
  exportedAt: string;
  cars: Car[];
  categories: Category[];
  entries: Entry[];
  reminders: Reminder[];
  settings: Settings;
}
