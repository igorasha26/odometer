import { describe, expect, it } from 'vitest';
import { averageDailyDistance } from '../mileage';
import type { Entry } from '../../../entities/types';

const entry = (date: string, odometer: number): Entry => ({
  id: date, carId: 'car', categoryId: 'c', date, odometer, amount: 0, createdAt: '',
});

describe('средний пробег', () => {
  it('считает километры в день по крайним записям', () => {
    expect(averageDailyDistance([entry('2026-01-01', 1000), entry('2026-01-11', 1500)])).toBeCloseTo(50, 5);
  });

  it('возвращает null, когда записей меньше двух', () => {
    expect(averageDailyDistance([entry('2026-01-01', 1000)])).toBeNull();
  });

  it('возвращает null при нулевом пробеге между записями', () => {
    expect(averageDailyDistance([entry('2026-01-01', 1000), entry('2026-01-11', 1000)])).toBeNull();
  });

  it('не зависит от порядка записей', () => {
    expect(averageDailyDistance([entry('2026-01-11', 1500), entry('2026-01-01', 1000)])).toBeCloseTo(50, 5);
  });
});
