import type { Entry, Money } from '../../entities/types';

export interface ConsumptionInterval {
  entryId: string;
  fromOdometer: number;
  toOdometer: number;
  distance: number;
  liters: number;
  /** л/100 км */
  consumption: number;
  date: string;
}

export type ConsumptionMethod = 'full-tank' | 'anchors' | 'none';

export interface FuelStats {
  /** Отрезки, по которым считался расход. */
  intervals: ConsumptionInterval[];
  consumption: number | null;
  method: ConsumptionMethod;
  totalLiters: number;
  totalFuelCost: Money;
  averagePricePerLiter: Money | null;
  /** Суммарный пробег отрезков, на которых расход посчитан. */
  trackedDistance: number;
  fillUps: number;
  /** Сколько заправок не попало в расчёт из-за отсутствия отметок пробега. */
  unusedFillUps: number;
}

/** Записи в хронологическом порядке: дата, при равенстве — порядок внесения. */
function chronological(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Пробег указан человеком, а не подставлен автоматически. */
function isAnchor(entry: Entry): boolean {
  return entry.odometerAuto !== true && entry.odometer > 0;
}

/**
 * Расход между отметками пробега — основной метод.
 *
 * Опорные точки — записи, где пробег указан вручную: ТО, заправка с введённым
 * одометром, любая другая запись с реальной цифрой. Между двумя такими точками
 * известно и расстояние, и сколько литров залито, — этого достаточно.
 *
 * Записи с автоматически подставленным пробегом опорными не считаются: их
 * одометр — копия предыдущего, и расстояние между ними вышло бы нулевым.
 */
export function anchorIntervals(entries: Entry[]): ConsumptionInterval[] {
  const ordered = chronological(entries);
  const anchorIndexes = ordered.reduce<number[]>((acc, entry, index) => {
    if (isAnchor(entry)) acc.push(index);
    return acc;
  }, []);

  const intervals: ConsumptionInterval[] = [];

  for (let i = 1; i < anchorIndexes.length; i++) {
    const fromIndex = anchorIndexes[i - 1];
    const toIndex = anchorIndexes[i];
    const from = ordered[fromIndex];
    const to = ordered[toIndex];

    const distance = to.odometer - from.odometer;
    if (distance <= 0) continue;

    // Литры, залитые после первой отметки и до второй включительно:
    // топливо из бака до первой отметки уже сожжено на предыдущем отрезке.
    let liters = 0;
    for (let j = fromIndex + 1; j <= toIndex; j++) {
      liters += ordered[j].fuel?.liters ?? 0;
    }
    if (liters <= 0) continue;

    intervals.push({
      entryId: to.id,
      fromOdometer: from.odometer,
      toOdometer: to.odometer,
      distance,
      liters,
      consumption: (liters / distance) * 100,
      date: to.date,
    });
  }

  return intervals;
}

/**
 * Расход методом full-to-full: между двумя заправками до полного бака.
 * Точнее остальных, потому что остаток в баке на концах отрезка одинаков,
 * но требует и отметки «полный бак», и указанного пробега.
 */
export function fullTankIntervals(entries: Entry[]): ConsumptionInterval[] {
  const ordered = chronological(entries).filter((e) => e.fuel && isAnchor(e));

  const intervals: ConsumptionInterval[] = [];
  let openIndex: number | null = null;
  let litersSinceFull = 0;

  ordered.forEach((entry, index) => {
    if (openIndex !== null) litersSinceFull += entry.fuel?.liters ?? 0;

    if (entry.fuel?.isFullTank) {
      if (openIndex !== null) {
        const from = ordered[openIndex];
        const distance = entry.odometer - from.odometer;
        if (distance > 0 && litersSinceFull > 0) {
          intervals.push({
            entryId: entry.id,
            fromOdometer: from.odometer,
            toOdometer: entry.odometer,
            distance,
            liters: litersSinceFull,
            consumption: (litersSinceFull / distance) * 100,
            date: entry.date,
          });
        }
      }
      openIndex = index;
      litersSinceFull = 0;
    }
  });

  return intervals;
}

function weighted(intervals: ConsumptionInterval[]): number | null {
  const distance = intervals.reduce((sum, i) => sum + i.distance, 0);
  const liters = intervals.reduce((sum, i) => sum + i.liters, 0);
  return distance > 0 ? (liters / distance) * 100 : null;
}

export function calculateFuelStats(entries: Entry[]): FuelStats {
  const fuelEntries = entries.filter((e) => e.fuel && e.fuel.liters > 0);

  const fullTank = fullTankIntervals(entries);
  const anchors = anchorIntervals(entries);

  // Полные баки точнее, но одного отрезка мало для устойчивой цифры.
  const useFullTank = fullTank.length >= 2;
  const intervals = useFullTank ? fullTank : anchors;

  const totalLiters = fuelEntries.reduce((sum, e) => sum + (e.fuel?.liters ?? 0), 0);
  const totalFuelCost = fuelEntries.reduce((sum, e) => sum + e.amount, 0);
  const countedLiters = intervals.reduce((sum, i) => sum + i.liters, 0);

  return {
    intervals,
    consumption: weighted(intervals),
    method: intervals.length ? (useFullTank ? 'full-tank' : 'anchors') : 'none',
    totalLiters,
    totalFuelCost,
    averagePricePerLiter: totalLiters > 0 ? Math.round(totalFuelCost / totalLiters) : null,
    trackedDistance: intervals.reduce((sum, i) => sum + i.distance, 0),
    fillUps: fuelEntries.length,
    unusedFillUps: Math.max(0, Math.round((totalLiters - countedLiters) * 100) / 100 > 0
      ? fuelEntries.filter((e) => e.odometerAuto).length
      : 0),
  };
}

export const METHOD_NOTES: Record<ConsumptionMethod, string> = {
  'full-tank': 'точно, по полным бакам',
  anchors: 'между отметками пробега',
  none: 'нужны две записи с указанным пробегом',
};

/** Любые два поля из трёх (литры / цена за литр / сумма) дают третье. */
export function completeFuelFields(input: {
  liters?: number;
  pricePerLiter?: Money;
  amount?: Money;
}): { liters?: number; pricePerLiter?: Money; amount?: Money } {
  const { liters, pricePerLiter, amount } = input;
  const has = (v?: number) => v !== undefined && v > 0;

  if (has(liters) && has(pricePerLiter)) return { ...input, amount: Math.round(liters! * pricePerLiter!) };
  if (has(liters) && has(amount)) return { ...input, pricePerLiter: Math.round(amount! / liters!) };
  if (has(pricePerLiter) && has(amount)) {
    return { ...input, liters: Math.round((amount! / pricePerLiter!) * 100) / 100 };
  }
  return input;
}
