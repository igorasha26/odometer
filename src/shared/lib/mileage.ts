import type { Entry } from '../../entities/types';

/**
 * Средний пробег в день по истории записей.
 * Нужен, чтобы показывать «столько-то километров в месяц» и прикидывать,
 * когда машина доедет до следующего ТО.
 */
export function averageDailyDistance(entries: Entry[]): number | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;

  const distance = Math.max(...sorted.map((e) => e.odometer)) - Math.min(...sorted.map((e) => e.odometer));
  const days = (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) / 86_400_000;
  if (days <= 0 || distance <= 0) return null;

  return distance / days;
}
