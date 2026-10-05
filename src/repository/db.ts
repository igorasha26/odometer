import Dexie, { type Table } from 'dexie';
import type { Car, Category, Entry, Reminder, Settings, User } from '../entities/types';
import { SYSTEM_CATEGORIES } from '../entities/categories';

export class OdometerDB extends Dexie {
  cars!: Table<Car, string>;
  categories!: Table<Category, string>;
  entries!: Table<Entry, string>;
  reminders!: Table<Reminder, string>;
  settings!: Table<Settings, string>;
  users!: Table<User, string>;

  constructor() {
    super('odometer');
    this.version(1).stores({
      cars: 'id, isArchived, createdAt',
      categories: 'id, kind, sortOrder, isHidden',
      entries: 'id, carId, categoryId, date, [carId+date], [carId+odometer]',
      reminders: 'id, carId, isDone, dueDate, dueOdometer',
      settings: 'id',
    });

    // Версия 2: учётные записи и привязка машин к владельцу.
    this.version(2).stores({
      cars: 'id, userId, isArchived, createdAt',
      users: 'id, &email',
    });
  }
}

export const db = new OdometerDB();

/**
 * Сид запускается один раз на загрузку страницы.
 * Без этого гарда параллельные вызовы (store грузит настройки и категории разом)
 * успевали оба увидеть пустую таблицу и создать по своему набору категорий.
 */
let seedPromise: Promise<void> | null = null;

/** Только для тестов: сбрасывает гард после очистки базы. */
export function resetSeedCache(): void {
  seedPromise = null;
}

export function seedIfEmpty(): Promise<void> {
  if (!seedPromise) seedPromise = runSeed().catch((e) => { seedPromise = null; throw e; });
  return seedPromise;
}

async function runSeed(): Promise<void> {
  await db.transaction('rw', db.categories, db.settings, async () => {
    const existing = await db.categories.toArray();

    if (existing.length === 0) {
      await db.categories.bulkAdd(SYSTEM_CATEGORIES.map((c) => ({ ...c, id: crypto.randomUUID() })));
    } else {
      // Добавляем только те системные категории, которых ещё нет: набор мог пополниться в новой версии.
      const names = new Set(existing.map((c) => c.name));
      const missing = SYSTEM_CATEGORIES.filter((c) => !names.has(c.name));
      if (missing.length) {
        await db.categories.bulkAdd(missing.map((c) => ({ ...c, id: crypto.randomUUID() })));
      }
    }

    if (!(await db.settings.get('settings'))) {
      await db.settings.put({ id: 'settings', currency: 'RUB', onboardingDone: false });
    }
  });

  await dedupeCategories();
  await migrateCategories();
}

/**
 * Правки набора категорий между версиями приложения.
 * У пользователей уже есть записи, поэтому категории не удаляются молча:
 * сначала записи переезжают взамену, и только потом категория исчезает.
 */
export async function migrateCategories(): Promise<void> {
  await db.transaction('rw', db.categories, db.entries, async () => {
    // «Страховка» стала «Документами»: раздел ведёт все сроки, не только полисы.
    const insurance = await db.categories.filter((c) => c.name === 'Страховка').first();
    if (insurance) {
      const existing = await db.categories.filter((c) => c.name === 'Документы').first();
      if (existing) {
        const affected = await db.entries.where('categoryId').equals(insurance.id).toArray();
        for (const entry of affected) await db.entries.update(entry.id, { categoryId: existing.id });
        await db.categories.delete(insurance.id);
      } else {
        await db.categories.update(insurance.id, { name: 'Документы' });
      }
    }

    // «Шины и диски» слились с «Запчастями».
    const tyres = await db.categories.filter((c) => c.name === 'Шины и диски').first();
    const parts = await db.categories.filter((c) => c.name === 'Запчасти').first();
    if (tyres && parts) {
      const affected = await db.entries.where('categoryId').equals(tyres.id).toArray();
      for (const entry of affected) {
        await db.entries.update(entry.id, {
          categoryId: parts.id,
          part: entry.part ?? { partName: 'Шины и диски' },
        });
      }
      await db.categories.delete(tyres.id);
    }
  });
}

/**
 * Разовая чистка для баз, где дубликаты уже успели появиться.
 * Записи с исчезающих категорий перевешиваем на оставшуюся, чтобы ничего не осиротело.
 */
export async function dedupeCategories(): Promise<number> {
  return db.transaction('rw', db.categories, db.entries, async () => {
    const all = await db.categories.orderBy('sortOrder').toArray();
    const keepByName = new Map<string, string>();
    const remap = new Map<string, string>();

    for (const category of all) {
      const kept = keepByName.get(category.name);
      if (kept === undefined) keepByName.set(category.name, category.id);
      else remap.set(category.id, kept);
    }
    if (remap.size === 0) return 0;

    const affected = await db.entries.where('categoryId').anyOf([...remap.keys()]).toArray();
    for (const entry of affected) {
      await db.entries.update(entry.id, { categoryId: remap.get(entry.categoryId)! });
    }
    await db.categories.bulkDelete([...remap.keys()]);
    return remap.size;
  });
}
