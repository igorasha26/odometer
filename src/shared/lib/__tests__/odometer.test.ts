import { describe, expect, it } from 'vitest';
import { conflictingEntries, currentOdometer, recalculateAutoOdometers } from '../odometer';
import type { Car, Entry } from '../../../entities/types';

const car: Car = {
  id: 'car', brand: 'VW', model: 'Passat', fuelType: 'ai95',
  initialOdometer: 145600, isArchived: false, createdAt: '',
};

const entry = (id: string, date: string, odometer: number, auto = false): Entry => ({
  id, carId: 'car', categoryId: 'c', date, odometer,
  odometerAuto: auto ? true : undefined,
  amount: 1000, createdAt: `2026-01-01T00:00:0${id}Z`,
});

describe('пересчёт подставленных пробегов', () => {
  it('обновляет записи после исправления пробега машины', () => {
    // Пробег вводили как 450 000, записи унаследовали ошибку
    const entries = [entry('1', '2026-09-01', 450000, true), entry('2', '2026-09-05', 450000, true)];
    const updates = recalculateAutoOdometers(car, entries);
    expect(updates).toEqual([
      { id: '1', odometer: 145600 },
      { id: '2', odometer: 145600 },
    ]);
  });

  it('не трогает записи с введённым вручную пробегом', () => {
    const entries = [entry('1', '2026-09-01', 146000), entry('2', '2026-09-05', 450000, true)];
    const updates = recalculateAutoOdometers(car, entries);
    expect(updates).toEqual([{ id: '2', odometer: 146000 }]);
  });

  it('наследует последнюю ручную отметку по хронологии', () => {
    const entries = [
      entry('1', '2026-09-01', 146000),
      entry('2', '2026-09-03', 0, true),
      entry('3', '2026-09-10', 149000),
      entry('4', '2026-09-12', 0, true),
    ];
    const updates = recalculateAutoOdometers(car, entries);
    expect(updates).toEqual([
      { id: '2', odometer: 146000 },
      { id: '4', odometer: 149000 },
    ]);
  });

  it('ничего не возвращает, когда всё уже верно', () => {
    const entries = [entry('1', '2026-09-01', 145600, true)];
    expect(recalculateAutoOdometers(car, entries)).toHaveLength(0);
  });
});

describe('текущий пробег', () => {
  it('берёт наибольшую достоверную отметку', () => {
    const entries = [entry('1', '2026-09-01', 146000), entry('2', '2026-09-05', 147000)];
    expect(currentOdometer(car, entries)).toBe(147000);
  });

  it('игнорирует подставленные значения', () => {
    const entries = [entry('1', '2026-09-01', 999999, true)];
    expect(currentOdometer(car, entries)).toBe(145600);
  });

  it('без записей равен пробегу машины', () => {
    expect(currentOdometer(car, [])).toBe(145600);
  });
});

describe('конфликты при понижении пробега', () => {
  it('находит записи с большим ручным пробегом', () => {
    const entries = [
      entry('1', '2026-09-01', 450000),
      entry('2', '2026-09-02', 140000),
      entry('3', '2026-09-03', 460000, true),
    ];
    const conflicts = conflictingEntries(entries, 145600);
    expect(conflicts.map((e) => e.id)).toEqual(['1']);
  });

  it('при повышении конфликтов нет', () => {
    expect(conflictingEntries([entry('1', '2026-09-01', 140000)], 200000)).toHaveLength(0);
  });
});
