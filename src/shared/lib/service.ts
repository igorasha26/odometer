import type { Car, Category, Entry, ISODate, Money } from '../../entities/types';
import { anchorIntervals } from './fuel';

export interface ServiceCycle {
  /** Пробег и дата последнего планового ТО. undefined — ТО ещё не отмечали. */
  lastOdometer?: number;
  lastDate?: ISODate;
  /** Пробег с последнего ТО (или с момента добавления машины). */
  distanceSince: number;
  /** Потрачено на машину с последнего ТО — включая топливо и всё остальное. */
  spentSince: Money;
  /** Залито литров с последнего ТО. */
  litersSince: number;
  /** Расход на этом отрезке, если заправок хватает. */
  consumptionSince: number | null;
  /** Пробег, на котором пора делать следующее ТО. */
  nextOdometer?: number;
  /** Сколько километров до него. Отрицательное — просрочено. */
  kmToNext?: number;
  /** Доля пройденного интервала, 0–100. Больше 100 — просрочено. */
  progress?: number;
}

/**
 * Сервисный интервал как единица отсчёта.
 *
 * ТО — естественная веха: машина обслужена, дальше начинается новый цикл.
 * Поэтому «с последнего ТО» — честная база для сравнения: пробег, деньги и топливо
 * на одинаковых по смыслу отрезках, а не за случайный календарный месяц.
 *
 * Расход при этом всё равно считается по заправкам внутри отрезка, а не делением
 * «литры между ТО на километры между ТО»: между ТО может не быть ни одной заправки
 * или, наоборот, последняя может быть залита за день до сервиса — тогда её литры
 * ещё не сожжены, и цифра поедет.
 */
export function serviceCycle(
  car: Car,
  entries: Entry[],
  categories: Category[],
  currentOdometer: number,
): ServiceCycle {
  const serviceCategoryIds = new Set(
    categories.filter((c) => c.kind === 'service').map((c) => c.id),
  );

  const services = entries
    .filter((e) => serviceCategoryIds.has(e.categoryId))
    .sort((a, b) => b.odometer - a.odometer);

  const last = services[0];
  const from = last?.odometer ?? car.initialOdometer;

  // Отрезок цикла: всё, что после последнего ТО. Само ТО — граница, не содержимое.
  const since = last
    ? entries.filter((e) => e.date > last.date || (e.date === last.date && e.id !== last.id))
    : [...entries];
  const fuelSince = since.filter((e) => e.fuel && e.fuel.liters > 0);
  // В расчёт расхода само ТО входит как опорная точка: от него и считаем.
  const cycleEntries = last ? [last, ...since] : since;

  const cycle: ServiceCycle = {
    lastOdometer: last?.odometer,
    lastDate: last?.date,
    distanceSince: Math.max(0, currentOdometer - from),
    spentSince: since.reduce((sum, e) => sum + e.amount, 0),
    litersSince: fuelSince.reduce((sum, e) => sum + (e.fuel?.liters ?? 0), 0),
    consumptionSince: weightedConsumption(anchorIntervals(cycleEntries)),
  };

  if (car.serviceIntervalKm) {
    cycle.nextOdometer = from + car.serviceIntervalKm;
    cycle.kmToNext = cycle.nextOdometer - currentOdometer;
    cycle.progress = Math.round((cycle.distanceSince / car.serviceIntervalKm) * 100);
  }

  return cycle;
}

function weightedConsumption(intervals: { distance: number; liters: number }[]): number | null {
  const distance = intervals.reduce((sum, i) => sum + i.distance, 0);
  const liters = intervals.reduce((sum, i) => sum + i.liters, 0);
  return distance > 0 ? (liters / distance) * 100 : null;
}
