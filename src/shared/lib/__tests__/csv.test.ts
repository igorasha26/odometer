import { describe, expect, it } from 'vitest';
import { entriesToCSV } from '../csv';
import type { Category, Entry } from '../../../entities/types';

const categories: Category[] = [
  { id: 'c1', name: 'Топливо', kind: 'fuel', color: '#000', isSystem: true, isHidden: false, sortOrder: 1 },
];

const entries: Entry[] = [
  {
    id: '1', carId: 'car', categoryId: 'c1', date: '2026-09-05', odometer: 142860,
    amount: 324000, createdAt: '',
    fuel: { liters: 42.1, pricePerLiter: 5500, isFullTank: true, fuelType: 'ai95', station: 'Лукойл' },
  },
  {
    id: '2', carId: 'car', categoryId: 'c1', date: '2026-09-01', odometer: 142000,
    amount: 100000, createdAt: '', note: 'Заметка; с точкой с запятой',
  },
];

describe('экспорт CSV', () => {
  it('ставит BOM, иначе Excel ломает кириллицу', () => {
    expect(entriesToCSV(entries, categories).startsWith('\uFEFF')).toBe(true);
  });

  it('разделяет точкой с запятой', () => {
    const [, firstRow] = entriesToCSV(entries, categories).split('\r\n');
    expect(firstRow.split(';')[0]).toBe('05.09.26');
  });

  it('берёт в кавычки поле с разделителем внутри', () => {
    expect(entriesToCSV(entries, categories)).toContain('"Заметка; с точкой с запятой"');
  });

  it('пишет дробные числа через запятую для русской локали Excel', () => {
    expect(entriesToCSV(entries, categories)).toContain('42,1');
  });
});
