import Dexie from 'dexie';
import { db, seedIfEmpty } from './db';
import type { BackupFile, EntryFilter, Repository } from './types';
import type {
  Car, Category, Entry, Reminder, Settings, User,
  NewCar, NewCategory, NewEntry, NewReminder, UUID,
} from '../entities/types';

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export const localRepository: Repository = {
  users: {
    count: () => db.users.count(),
    async findByEmail(email: string) {
      return db.users.where('email').equals(email.trim().toLowerCase()).first();
    },
    get: (userId) => db.users.get(userId),
    async create(user) {
      const created: User = {
        ...user,
        email: user.email.trim().toLowerCase(),
        id: id(),
        createdAt: now(),
      };
      await db.users.add(created);
      return created;
    },
    async update(userId, patch) {
      await db.users.update(userId, patch);
      const updated = await db.users.get(userId);
      if (!updated) throw new Error(`Пользователь ${userId} не найден`);
      return updated;
    },
  },

  cars: {
    async list(includeArchived = false, userId?: UUID) {
      // При одинаковом createdAt (машины заведены в одну миллисекунду) порядок
      // из индекса не определён — доупорядочиваем по id, чтобы список не плавал.
      const all = (await db.cars.toArray())
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      const mine = userId
        // Машины без владельца достались от версии без входа — отдаём их первому вошедшему.
        ? all.filter((c) => c.userId === userId || c.userId === undefined)
        : all;
      return includeArchived ? mine : mine.filter((c) => !c.isArchived);
    },
    get: (carId) => db.cars.get(carId),
    async create(car: NewCar) {
      const created: Car = { ...car, isArchived: car.isArchived ?? false, id: id(), createdAt: now() };
      await db.cars.add(created);
      return created;
    },
    async update(carId, patch) {
      await db.cars.update(carId, patch);
      const updated = await db.cars.get(carId);
      if (!updated) throw new Error(`Автомобиль ${carId} не найден`);
      return updated;
    },
    async remove(carId) {
      // Записи без машины бессмысленны — удаляем вместе, одной транзакцией.
      await db.transaction('rw', db.cars, db.entries, db.reminders, async () => {
        await db.entries.where('carId').equals(carId).delete();
        await db.reminders.where('carId').equals(carId).delete();
        await db.cars.delete(carId);
      });
    },
  },

  categories: {
    async list(includeHidden = false) {
      await seedIfEmpty();
      const all = await db.categories.orderBy('sortOrder').toArray();
      return includeHidden ? all : all.filter((c) => !c.isHidden);
    },
    async create(category: NewCategory) {
      const created: Category = { ...category, isSystem: category.isSystem ?? false, id: id() };
      await db.categories.add(created);
      return created;
    },
    async update(categoryId, patch) {
      await db.categories.update(categoryId, patch);
      const updated = await db.categories.get(categoryId);
      if (!updated) throw new Error(`Категория ${categoryId} не найдена`);
      return updated;
    },
    async remove(categoryId) {
      const category = await db.categories.get(categoryId);
      if (category?.isSystem) throw new Error('Системную категорию можно только скрыть');
      const used = await db.entries.where('categoryId').equals(categoryId).count();
      if (used > 0) throw new Error(`Категория используется в ${used} записях`);
      await db.categories.delete(categoryId);
    },
  },

  entries: {
    async list(filter: EntryFilter = {}) {
      let rows: Entry[];
      if (filter.carId && filter.from && filter.to) {
        rows = await db.entries
          .where('[carId+date]')
          .between([filter.carId, filter.from], [filter.carId, filter.to], true, true)
          .toArray();
      } else if (filter.carId) {
        rows = await db.entries.where('carId').equals(filter.carId).toArray();
      } else {
        rows = await db.entries.toArray();
      }

      if (filter.from && !(filter.carId && filter.to)) rows = rows.filter((e) => e.date >= filter.from!);
      if (filter.to && !(filter.carId && filter.from)) rows = rows.filter((e) => e.date <= filter.to!);
      if (filter.categoryIds?.length) {
        const set = new Set(filter.categoryIds);
        rows = rows.filter((e) => set.has(e.categoryId));
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        rows = rows.filter((e) =>
          e.note?.toLowerCase().includes(q) ||
          e.part?.partName.toLowerCase().includes(q) ||
          e.fuel?.station?.toLowerCase().includes(q),
        );
      }
      // Сортировка по дате, при равной дате — по пробегу: порядок создания не важен,
      // записи вносят задним числом.
      return rows.sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer);
    },
    get: (entryId) => db.entries.get(entryId),
    async create(entry: NewEntry) {
      const created: Entry = { ...entry, id: id(), createdAt: now() };
      await db.entries.add(created);
      return created;
    },
    async update(entryId, patch) {
      await db.entries.update(entryId, patch);
      const updated = await db.entries.get(entryId);
      if (!updated) throw new Error(`Запись ${entryId} не найдена`);
      return updated;
    },
    remove: (entryId) => db.entries.delete(entryId),
    async lastOdometer(carId: UUID) {
      const last = await db.entries
        .where('[carId+odometer]')
        .between([carId, Dexie.minKey], [carId, Dexie.maxKey])
        .last();
      return last?.odometer;
    },
  },

  reminders: {
    async list(carId) {
      const rows = carId
        ? await db.reminders.where('carId').equals(carId).toArray()
        : await db.reminders.toArray();
      return rows.sort((a, b) => Number(a.isDone) - Number(b.isDone));
    },
    async create(reminder: NewReminder) {
      const created: Reminder = { ...reminder, isDone: reminder.isDone ?? false, id: id(), createdAt: now() };
      await db.reminders.add(created);
      return created;
    },
    async update(reminderId, patch) {
      await db.reminders.update(reminderId, patch);
      const updated = await db.reminders.get(reminderId);
      if (!updated) throw new Error(`Напоминание ${reminderId} не найдено`);
      return updated;
    },
    remove: (reminderId) => db.reminders.delete(reminderId),
  },

  settings: {
    async get() {
      await seedIfEmpty();
      const s = await db.settings.get('settings');
      return s as Settings;
    },
    async update(patch) {
      const current = await db.settings.get('settings');
      const next: Settings = { ...(current as Settings), ...patch, id: 'settings' };
      await db.settings.put(next);
      return next;
    },
  },

  backup: {
    async export(): Promise<BackupFile> {
      const [cars, categories, entries, reminders, settings] = await Promise.all([
        db.cars.toArray(),
        db.categories.toArray(),
        db.entries.toArray(),
        db.reminders.toArray(),
        db.settings.get('settings'),
      ]);
      return {
        version: 1,
        exportedAt: now(),
        cars, categories, entries, reminders,
        settings: settings as Settings,
      };
    },
    async import(data: BackupFile, mode) {
      if (data.version !== 1) throw new Error('Неподдерживаемая версия файла резервной копии');
      await db.transaction('rw', db.cars, db.categories, db.entries, db.reminders, db.settings, async () => {
        if (mode === 'replace') {
          await Promise.all([db.cars.clear(), db.categories.clear(), db.entries.clear(), db.reminders.clear()]);
        }
        await db.cars.bulkPut(data.cars);
        await db.categories.bulkPut(data.categories);
        await db.entries.bulkPut(data.entries);
        await db.reminders.bulkPut(data.reminders);
        if (mode === 'replace' && data.settings) await db.settings.put(data.settings);
      });
    },
  },
};
