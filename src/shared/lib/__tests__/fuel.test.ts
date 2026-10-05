import { describe, expect, it } from 'vitest';
import { anchorIntervals, calculateFuelStats, completeFuelFields, fullTankIntervals } from '../fuel';
import type { Entry } from '../../../entities/types';

let seq = 0;

function fill(
  date: string, odometer: number | null, liters: number,
  options: { full?: boolean; amount?: number } = {},
): Entry {
  seq += 1;
  return {
    id: `f${seq}`,
    carId: 'car',
    categoryId: 'fuel',
    date,
    odometer: odometer ?? 100000,
    odometerAuto: odometer === null ? true : undefined,
    amount: options.amount ?? 100000,
    createdAt: `2026-01-01T00:00:${String(seq).padStart(2, '0')}Z`,
    fuel: {
      liters,
      pricePerLiter: Math.round((options.amount ?? 100000) / liters),
      isFullTank: options.full ?? false,
      fuelType: 'ai95',
    },
  };
}

function service(date: string, odometer: number): Entry {
  seq += 1;
  return {
    id: `s${seq}`, carId: 'car', categoryId: 'service', date, odometer,
    amount: 1000000, createdAt: `2026-01-01T00:00:${String(seq).padStart(2, '0')}Z`,
  };
}

describe('расход между отметками пробега', () => {
  it('считает от ТО до ТО по залитым внутри литрам', () => {
    // 5000 км между ТО, внутри залито 200 + 200 = 400 л → 8 л/100
    const entries = [
      service('2026-01-01', 100000),
      fill('2026-02-01', null, 200),
      fill('2026-03-01', null, 200),
      service('2026-04-01', 105000),
    ];
    const intervals = anchorIntervals(entries);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].distance).toBe(5000);
    expect(intervals[0].liters).toBe(400);
    expect(intervals[0].consumption).toBeCloseTo(8, 5);
  });

  it('игнорирует записи с автоматически подставленным пробегом как опорные', () => {
    // У всех заправок пробег скопирован — расстояния между ними нет
    const entries = [fill('2026-01-01', null, 40), fill('2026-02-01', null, 40)];
    expect(anchorIntervals(entries)).toHaveLength(0);
  });

  it('заправка с введённым пробегом сама становится отметкой', () => {
    const entries = [fill('2026-01-01', 100000, 40), fill('2026-02-01', 100500, 40)];
    const intervals = anchorIntervals(entries);
    expect(intervals[0].consumption).toBeCloseTo(8, 5);
  });

  it('не берёт литры первой отметки: они сожжены до неё', () => {
    const entries = [fill('2026-01-01', 100000, 60), fill('2026-02-01', 100500, 40)];
    expect(anchorIntervals(entries)[0].liters).toBe(40);
  });

  it('пропускает отрезок без заправок', () => {
    const entries = [service('2026-01-01', 100000), service('2026-04-01', 105000)];
    expect(anchorIntervals(entries)).toHaveLength(0);
  });

  it('пропускает отрезок с обратным пробегом', () => {
    const entries = [service('2026-01-01', 105000), fill('2026-02-01', null, 40), service('2026-03-01', 100000)];
    expect(anchorIntervals(entries)).toHaveLength(0);
  });

  it('считает несколько отрезков подряд', () => {
    const entries = [
      service('2026-01-01', 100000),
      fill('2026-02-01', null, 400),
      service('2026-03-01', 105000),
      fill('2026-04-01', null, 450),
      service('2026-05-01', 110000),
    ];
    expect(anchorIntervals(entries)).toHaveLength(2);
  });
});

describe('точный расход по полным бакам', () => {
  it('считает между двумя полными', () => {
    const entries = [
      fill('2026-01-01', 100000, 45, { full: true }),
      fill('2026-02-01', 100500, 40, { full: true }),
    ];
    expect(fullTankIntervals(entries)[0].consumption).toBeCloseTo(8, 5);
  });

  it('не берёт заправки без указанного пробега', () => {
    const entries = [
      fill('2026-01-01', 100000, 45, { full: true }),
      fill('2026-02-01', null, 40, { full: true }),
    ];
    expect(fullTankIntervals(entries)).toHaveLength(0);
  });
});

describe('выбор метода', () => {
  it('с двумя интервалами полного бака выбирает точный метод', () => {
    const entries = [
      fill('2026-01-01', 100000, 40, { full: true }),
      fill('2026-02-01', 100500, 40, { full: true }),
      fill('2026-03-01', 101000, 40, { full: true }),
    ];
    expect(calculateFuelStats(entries).method).toBe('full-tank');
  });

  it('одного полного интервала мало — считает между отметками', () => {
    const entries = [
      fill('2026-01-01', 100000, 40, { full: true }),
      fill('2026-02-01', 100500, 40, { full: true }),
    ];
    expect(calculateFuelStats(entries).method).toBe('anchors');
  });

  it('без отметок пробега расход не считается', () => {
    const stats = calculateFuelStats([fill('2026-01-01', null, 40), fill('2026-02-01', null, 40)]);
    expect(stats.method).toBe('none');
    expect(stats.consumption).toBeNull();
    expect(stats.totalLiters).toBe(80); // литры и деньги всё равно видны
  });

  it('взвешивает расход по километрам, а не по отрезкам', () => {
    const entries = [
      service('2026-01-01', 100000),
      fill('2026-01-15', null, 10),
      service('2026-02-01', 100100),   // 10 л / 100 км = 10 л/100
      fill('2026-02-15', null, 60),
      service('2026-03-01', 101100),   // 60 л / 1000 км = 6 л/100
    ];
    // Простое среднее дало бы 8; взвешенное = 70 л / 1100 км = 6,36
    expect(calculateFuelStats(entries).consumption).toBeCloseTo(6.36, 1);
  });

  it('считает среднюю цену литра по всем заправкам', () => {
    const entries = [
      fill('2026-01-01', 100000, 10, { amount: 50000 }),
      fill('2026-02-01', 100500, 40, { amount: 240000 }),
    ];
    expect(calculateFuelStats(entries).averagePricePerLiter).toBe(5800);
  });
});

describe('связь литров, цены и суммы', () => {
  it('сумма из литров и цены', () => {
    expect(completeFuelFields({ liters: 40, pricePerLiter: 5500 }).amount).toBe(220000);
  });

  it('цена из литров и суммы', () => {
    expect(completeFuelFields({ liters: 40, amount: 220000 }).pricePerLiter).toBe(5500);
  });

  it('литры из цены и суммы', () => {
    expect(completeFuelFields({ pricePerLiter: 5000, amount: 100000 }).liters).toBe(20);
  });

  it('пересчитывает, даже если третье поле уже заполнено', () => {
    expect(completeFuelFields({ liters: 20, pricePerLiter: 8100, amount: 6000 }).amount).toBe(162000);
  });
});
