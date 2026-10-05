import type { Entry, NewEntry } from '../../entities/types';
import { toISODate } from './stats';

export interface ValidationIssue {
  field: string;
  message: string;
  /** warning — можно сохранить, error — нельзя. */
  level: 'error' | 'warning';
}

/**
 * Пробег назад бывает по-настоящему: замена панели приборов, скрутка перед покупкой.
 * Поэтому это предупреждение, а не запрет.
 */
export function validateEntry(entry: NewEntry, existing: Entry[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (entry.amount < 0) {
    issues.push({ field: 'amount', message: 'Сумма не может быть отрицательной', level: 'error' });
  }
  if (!Number.isFinite(entry.odometer) || entry.odometer < 0) {
    issues.push({ field: 'odometer', message: 'Укажите пробег', level: 'error' });
  }
  if (entry.date > toISODate(new Date())) {
    issues.push({ field: 'date', message: 'Дата в будущем', level: 'warning' });
  }
  if (entry.fuel) {
    if (entry.fuel.liters <= 0) {
      issues.push({ field: 'liters', message: 'Объём должен быть больше нуля', level: 'error' });
    }
  }

  const earlier = existing.filter((e) => e.carId === entry.carId && e.date <= entry.date);
  const maxEarlier = earlier.length ? Math.max(...earlier.map((e) => e.odometer)) : undefined;
  if (maxEarlier !== undefined && entry.odometer < maxEarlier) {
    issues.push({
      field: 'odometer',
      message: `Меньше пробега предыдущей записи (${maxEarlier.toLocaleString('ru-RU')} км)`,
      level: 'warning',
    });
  }

  return issues;
}
