import { describe, expect, it } from 'vitest';
import { distanceInPeriod, monthRange, monthsAgo, periodRange, summarize, toISODate } from '../stats';
import type { Category, Entry } from '../../../entities/types';

const categories: Category[] = [
  { id: 'c1', name: 'Топливо', kind: 'fuel', color: '#000', isSystem: true, isHidden: false, sortOrder: 1 },
  { id: 'c2', name: 'Мойка', kind: 'wash', color: '#111', isSystem: true, isHidden: false, sortOrder: 2 },
];

const entries: Entry[] = [
  { id: '1', carId: 'car', categoryId: 'c1', date: '2026-01-10', odometer: 1000, amount: 300000, createdAt: '' },
  { id: '2', carId: 'car', categoryId: 'c2', date: '2026-02-10', odometer: 1500, amount: 100000, createdAt: '' },
];

describe('сводка за период', () => {
  it('считает сумму и стоимость километра', () => {
    const s = summarize(entries, categories);
    expect(s.total).toBe(400000);
    expect(s.distance).toBe(500);
    expect(s.costPerKm).toBe(800); // 4000 ₽ / 500 км = 8 ₽/км
  });

  it('раскладывает по категориям с долями', () => {
    const s = summarize(entries, categories);
    expect(s.byCategory[0].name).toBe('Топливо');
    expect(s.byCategory[0].share).toBe(75);
  });

  it('группирует по месяцам в хронологическом порядке', () => {
    const s = summarize(entries, categories);
    expect(s.byMonth.map((m) => m.month)).toEqual(['2026-01', '2026-02']);
  });

  it('не считает пробег по одной записи', () => {
    expect(distanceInPeriod([entries[0]])).toBe(0);
  });

  it('не сдвигает дату в вечерних часовых поясах', () => {
    expect(toISODate(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05');
  });
});

describe('границы периодов', () => {
  const today = new Date(2026, 8, 15); // 15 сентября 2026

  it('месяц начинается с первого числа, а не 30 дней назад', () => {
    expect(periodRange('month', today)).toEqual({ from: '2026-09-01', to: '2026-09-15' });
  });

  it('три месяца — это три календарных месяца', () => {
    expect(periodRange('quarter', today).from).toBe('2026-07-01');
  });

  it('год — двенадцать календарных месяцев', () => {
    expect(periodRange('year', today).from).toBe('2025-10-01');
  });

  it('всё время не задаёт нижнюю границу', () => {
    expect(periodRange('all', today).from).toBeUndefined();
  });

  it('границы месяца включают последний день', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2024-02').to).toBe('2024-02-29'); // високосный
  });
});

describe('сколько времени прошло', () => {
  const today = new Date(2026, 8, 15);

  it('склоняет месяцы', () => {
    expect(monthsAgo('2026-07-15', today)).toBe('2 месяца назад');
    expect(monthsAgo('2025-12-15', today)).toBe('9 месяцев назад');
  });

  it('склоняет дни и недели', () => {
    expect(monthsAgo('2026-09-14', today)).toBe('1 день назад');
    expect(monthsAgo('2026-09-01', today)).toBe('2 недели назад');
  });

  it('понимает сегодня и будущее', () => {
    expect(monthsAgo('2026-09-15', today)).toBe('сегодня');
    expect(monthsAgo('2026-10-01', today)).toBe('в планах');
  });
});
