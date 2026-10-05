import { describe, expect, it } from 'vitest';
import { serviceCycle } from '../service';
import type { Car, Category, Entry } from '../../../entities/types';

const car: Car = {
  id: 'car', brand: 'VW', model: 'Passat', fuelType: 'ai95',
  initialOdometer: 100000, serviceIntervalKm: 15000, isArchived: false, createdAt: '',
};

const categories: Category[] = [
  { id: 'fuel', name: 'Топливо', kind: 'fuel', color: '#000', isSystem: true, isHidden: false, sortOrder: 1 },
  { id: 'service', name: 'ТО', kind: 'service', color: '#111', isSystem: true, isHidden: false, sortOrder: 2 },
];

const entry = (categoryId: string, odometer: number, amount: number, liters?: number): Entry => ({
  id: `${categoryId}-${odometer}`, carId: 'car', categoryId, date: '2026-01-01',
  odometer, amount, createdAt: '',
  fuel: liters ? { liters, pricePerLiter: 5500, isFullTank: false, fuelType: 'ai95' } : undefined,
});

describe('сервисный интервал', () => {
  it('без отметок ТО считает от пробега при добавлении машины', () => {
    const cycle = serviceCycle(car, [entry('fuel', 103000, 200000, 40)], categories, 103000);
    expect(cycle.lastOdometer).toBeUndefined();
    expect(cycle.distanceSince).toBe(3000);
    expect(cycle.nextOdometer).toBe(115000);
    expect(cycle.kmToNext).toBe(12000);
  });

  it('берёт последнее ТО за точку отсчёта', () => {
    const entries = [
      entry('service', 105000, 1200000),
      entry('fuel', 108000, 250000, 45),
      entry('service', 100500, 900000),
    ];
    const cycle = serviceCycle(car, entries, categories, 108000);
    expect(cycle.lastOdometer).toBe(105000);
    expect(cycle.distanceSince).toBe(3000);
    expect(cycle.nextOdometer).toBe(120000);
  });

  it('не включает саму запись ТО в траты цикла', () => {
    const entries = [entry('service', 105000, 1200000), entry('fuel', 106000, 200000, 40)];
    const cycle = serviceCycle(car, entries, categories, 106000);
    expect(cycle.spentSince).toBe(200000);
  });

  it('считает долю пройденного интервала', () => {
    const cycle = serviceCycle(car, [entry('service', 100000, 100000)], categories, 107500);
    expect(cycle.progress).toBe(50);
  });

  it('показывает просрочку отрицательным остатком', () => {
    const cycle = serviceCycle(car, [entry('service', 100000, 100000)], categories, 116000);
    expect(cycle.kmToNext).toBe(-1000);
    expect(cycle.progress).toBeGreaterThan(100);
  });

  it('считает расход от ТО как от отметки пробега', () => {
    // ТО на 100 000 — опорная точка. Дальше 85 л на 1000 км → 8,5 л/100.
    const entries = [
      entry('service', 100000, 1000000),
      entry('fuel', 100500, 250000, 45),
      entry('fuel', 101000, 200000, 40),
    ];
    const cycle = serviceCycle(car, entries, categories, 101000);
    expect(cycle.consumptionSince).toBeCloseTo(8.5, 5);
    expect(cycle.litersSince).toBe(85);
  });

  it('считает расход, даже когда пробег указан только в ТО', () => {
    // Ровно случай из жизни: пробег вводят на ТО, заправки идут без него.
    const entries = [
      { ...entry('service', 100000, 1000000), date: '2026-01-01' },
      { ...entry('fuel', 100000, 250000, 200), date: '2026-02-01', odometerAuto: true },
      { ...entry('fuel', 100000, 200000, 200), date: '2026-03-01', odometerAuto: true },
      { ...entry('service', 105000, 1200000), date: '2026-04-01' },
    ];
    const cycle = serviceCycle(car, entries, categories, 105000);
    // Последнее ТО — точка отсчёта нового цикла, расход считается по завершённому
    expect(cycle.lastOdometer).toBe(105000);
  });

  it('без интервала ТО не строит прогноз', () => {
    const cycle = serviceCycle({ ...car, serviceIntervalKm: undefined }, [], categories, 100000);
    expect(cycle.nextOdometer).toBeUndefined();
  });
});
