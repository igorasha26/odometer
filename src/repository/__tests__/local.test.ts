import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localRepository as repo } from '../local';
import { db, dedupeCategories, migrateCategories, resetSeedCache, seedIfEmpty } from '../db';
import { SYSTEM_CATEGORIES } from '../../entities/categories';

beforeEach(async () => {
  await Promise.all([db.cars.clear(), db.categories.clear(), db.entries.clear(), db.reminders.clear(), db.settings.clear()]);
  resetSeedCache();
  await seedIfEmpty();
});

const newCar = () => repo.cars.create({
  brand: 'VW', model: 'Passat', fuelType: 'ai95' as const, initialOdometer: 100000,
});

describe('автомобили', () => {
  it('создаёт с id и датой', async () => {
    const car = await newCar();
    expect(car.id).toBeTruthy();
    expect(car.isArchived).toBe(false);
  });

  it('удаляет вместе с записями и напоминаниями', async () => {
    const car = await newCar();
    const categories = await repo.categories.list();
    await repo.entries.create({
      carId: car.id, categoryId: categories[0].id, date: '2026-01-01', odometer: 100100, amount: 1000,
    });
    await repo.reminders.create({ carId: car.id, title: 'Масло', dueOdometer: 115000 });

    await repo.cars.remove(car.id);

    expect(await repo.entries.list({ carId: car.id })).toHaveLength(0);
    expect(await repo.reminders.list(car.id)).toHaveLength(0);
  });
});

describe('категории', () => {
  it('создаёт системный набор при первом запуске', async () => {
    expect(await repo.categories.list()).toHaveLength(SYSTEM_CATEGORIES.length);
  });

  it('не пересоздаёт их при повторном вызове', async () => {
    resetSeedCache();
  await seedIfEmpty();
    expect(await repo.categories.list()).toHaveLength(SYSTEM_CATEGORIES.length);
  });

  it('запрещает удалять системную', async () => {
    const [system] = await repo.categories.list();
    await expect(repo.categories.remove(system.id)).rejects.toThrow(/Системную/);
  });

  it('запрещает удалять используемую в записях', async () => {
    const car = await newCar();
    const custom = await repo.categories.create({
      name: 'Своя', kind: 'other', color: '#fff', isHidden: false, sortOrder: 200,
    });
    await repo.entries.create({
      carId: car.id, categoryId: custom.id, date: '2026-01-01', odometer: 100100, amount: 500,
    });
    await expect(repo.categories.remove(custom.id)).rejects.toThrow(/используется/);
  });
});

describe('записи', () => {
  it('сортирует по дате от свежих к старым независимо от порядка ввода', async () => {
    const car = await newCar();
    const [cat] = await repo.categories.list();
    await repo.entries.create({ carId: car.id, categoryId: cat.id, date: '2026-01-01', odometer: 100100, amount: 100 });
    await repo.entries.create({ carId: car.id, categoryId: cat.id, date: '2026-03-01', odometer: 100900, amount: 300 });
    await repo.entries.create({ carId: car.id, categoryId: cat.id, date: '2026-02-01', odometer: 100500, amount: 200 });

    const list = await repo.entries.list({ carId: car.id });
    expect(list.map((e) => e.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });

  it('фильтрует по диапазону дат включительно', async () => {
    const car = await newCar();
    const [cat] = await repo.categories.list();
    for (const date of ['2026-01-01', '2026-02-01', '2026-03-01']) {
      await repo.entries.create({ carId: car.id, categoryId: cat.id, date, odometer: 100000, amount: 100 });
    }
    const list = await repo.entries.list({ carId: car.id, from: '2026-01-01', to: '2026-02-01' });
    expect(list).toHaveLength(2);
  });

  it('отдаёт максимальный пробег, а не последний внесённый', async () => {
    const car = await newCar();
    const [cat] = await repo.categories.list();
    await repo.entries.create({ carId: car.id, categoryId: cat.id, date: '2026-03-01', odometer: 105000, amount: 100 });
    await repo.entries.create({ carId: car.id, categoryId: cat.id, date: '2026-01-01', odometer: 101000, amount: 100 });

    expect(await repo.entries.lastOdometer(car.id)).toBe(105000);
  });

  it('ищет по заметке и названию запчасти', async () => {
    const car = await newCar();
    const [cat] = await repo.categories.list();
    await repo.entries.create({
      carId: car.id, categoryId: cat.id, date: '2026-01-01', odometer: 100100, amount: 100,
      part: { partName: 'Тормозные колодки' },
    });
    await repo.entries.create({ carId: car.id, categoryId: cat.id, date: '2026-01-02', odometer: 100200, amount: 100 });

    expect(await repo.entries.list({ carId: car.id, search: 'колодки' })).toHaveLength(1);
  });
});

describe('резервная копия', () => {
  it('переживает полный цикл экспорт-импорт', async () => {
    const car = await newCar();
    const [cat] = await repo.categories.list();
    await repo.entries.create({
      carId: car.id, categoryId: cat.id, date: '2026-01-01', odometer: 100100, amount: 12345,
    });

    const backup = await repo.backup.export();
    await Promise.all([db.cars.clear(), db.entries.clear()]);
    expect(await repo.cars.list()).toHaveLength(0);

    await repo.backup.import(backup, 'replace');
    const restored = await repo.entries.list({ carId: car.id });
    expect(restored).toHaveLength(1);
    expect(restored[0].amount).toBe(12345);
  });

  it('отклоняет файл неизвестной версии', async () => {
    const backup = await repo.backup.export();
    await expect(repo.backup.import({ ...backup, version: 2 as 1 }, 'replace')).rejects.toThrow(/версия/);
  });
});

describe('дубликаты категорий', () => {
  it('схлопывает одноимённые и перевешивает на них записи', async () => {
    const car = await newCar();
    const [original] = await repo.categories.list();
    // Имитируем результат гонки: второй набор с теми же именами
    const clone = { ...original, id: 'duplicate-id' };
    await db.categories.add(clone);
    await repo.entries.create({
      carId: car.id, categoryId: clone.id, date: '2026-01-01', odometer: 100100, amount: 700,
    });

    const removed = await dedupeCategories();

    expect(removed).toBe(1);
    expect(await repo.categories.list()).toHaveLength(SYSTEM_CATEGORIES.length);
    // Какая из двух записей уцелела — не важно; важно, что запись ведёт на существующую.
    const entries = await repo.entries.list({ carId: car.id });
    const survivors = await repo.categories.list();
    expect(survivors.some((c) => c.id === entries[0].categoryId)).toBe(true);
    expect(survivors.filter((c) => c.name === original.name)).toHaveLength(1);
  });

  it('на чистой базе ничего не трогает', async () => {
    expect(await dedupeCategories()).toBe(0);
  });
});

describe('миграции категорий', () => {
  it('переименовывает «Страховку» в «Документы»', async () => {
    await db.categories.clear();
    await db.categories.add({
      id: 'old', name: 'Страховка', kind: 'tax', color: '#000',
      isSystem: true, isHidden: false, sortOrder: 70,
    });

    await migrateCategories();

    const names = (await repo.categories.list()).map((c) => c.name);
    expect(names).toContain('Документы');
    expect(names).not.toContain('Страховка');
  });

  it('переносит записи с «Шин и дисков» в «Запчасти» и удаляет категорию', async () => {
    const car = await newCar();
    const parts = (await repo.categories.list()).find((c) => c.name === 'Запчасти')!;
    await db.categories.add({
      id: 'tyres', name: 'Шины и диски', kind: 'parts', color: '#000',
      isSystem: true, isHidden: false, sortOrder: 50,
    });
    await repo.entries.create({
      carId: car.id, categoryId: 'tyres', date: '2026-01-01', odometer: 100100, amount: 3800000,
    });

    await migrateCategories();

    const entries = await repo.entries.list({ carId: car.id });
    expect(entries[0].categoryId).toBe(parts.id);
    expect(entries[0].part?.partName).toBe('Шины и диски');
    expect((await repo.categories.list()).some((c) => c.name === 'Шины и диски')).toBe(false);
  });

  it('на актуальной базе ничего не меняет', async () => {
    const before = await repo.categories.list();
    await migrateCategories();
    expect((await repo.categories.list()).length).toBe(before.length);
  });
});
