import type { Category, Entry, ISODate, Money } from '../../entities/types';

export interface CategoryBreakdown {
  categoryId: string;
  name: string;
  color: string;
  total: Money;
  /** Доля в процентах, 0–100. */
  share: number;
  count: number;
}

export interface MonthlyPoint {
  /** 'YYYY-MM' */
  month: string;
  label: string;
  total: Money;
}

export interface PeriodSummary {
  total: Money;
  entriesCount: number;
  distance: number;
  /** Стоимость километра в копейках. null, если пробег за период неизвестен. */
  costPerKm: Money | null;
  byCategory: CategoryBreakdown[];
  byMonth: MonthlyPoint[];
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function monthLabel(month: string): string {
  const [, m] = month.split('-');
  return MONTHS_SHORT[Number(m) - 1] ?? month;
}

/**
 * Пробег за период = разница между максимальным и минимальным одометром.
 * По одной записи пробег посчитать нельзя — вернём 0.
 */
export function distanceInPeriod(entries: Entry[]): number {
  if (entries.length < 2) return 0;
  const odometers = entries.map((e) => e.odometer);
  return Math.max(...odometers) - Math.min(...odometers);
}

export function summarize(entries: Entry[], categories: Category[]): PeriodSummary {
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  const distance = distanceInPeriod(entries);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, { total: Money; count: number }>();
  for (const entry of entries) {
    const current = totals.get(entry.categoryId) ?? { total: 0, count: 0 };
    totals.set(entry.categoryId, { total: current.total + entry.amount, count: current.count + 1 });
  }

  const byCategory: CategoryBreakdown[] = [...totals.entries()]
    .map(([categoryId, { total: catTotal, count }]) => {
      const category = categoryMap.get(categoryId);
      return {
        categoryId,
        name: category?.name ?? 'Удалённая категория',
        color: category?.color ?? '#75798c',
        total: catTotal,
        share: total > 0 ? (catTotal / total) * 100 : 0,
        count,
      };
    })
    .sort((a, b) => b.total - a.total);

  const monthTotals = new Map<string, Money>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + entry.amount);
  }
  const byMonth: MonthlyPoint[] = [...monthTotals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, monthTotal]) => ({ month, label: monthLabel(month), total: monthTotal }));

  return {
    total,
    entriesCount: entries.length,
    distance,
    costPerKm: distance > 0 ? Math.round(total / distance) : null,
    byCategory,
    byMonth,
  };
}

export type PeriodPreset = 'month' | 'quarter' | 'halfYear' | 'year' | 'all' | 'custom';

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  month: 'Месяц',
  quarter: '3 месяца',
  halfYear: '6 месяцев',
  year: 'Год',
  all: 'Всё время',
  custom: 'Свой период',
};

/** Пресеты, которые показываются кнопками. «Свой период» живёт отдельно. */
export const PERIOD_PRESETS: PeriodPreset[] = ['month', 'quarter', 'halfYear', 'year', 'all'];

export interface DateRange {
  from?: ISODate;
  to: ISODate;
}

/**
 * Границы периода по календарю, а не по скользящему окну.
 *
 * «Месяц» — это текущий месяц с первого числа: человек хочет видеть,
 * сколько потратил в сентябре, а не за последние 30 дней, которые
 * захватывают половину августа. Остальные пресеты — целые месяцы назад,
 * поэтому в графике по месяцам получается ровно 3, 6 или 12 столбцов.
 */
export function periodRange(preset: PeriodPreset, today = new Date()): DateRange {
  const to = toISODate(today);
  if (preset === 'all' || preset === 'custom') return { to };

  const monthsBack = { month: 0, quarter: 2, halfYear: 5, year: 11 }[preset];
  const from = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  return { from: toISODate(from), to };
}

/** Границы одного месяца: 'YYYY-MM' → с первого по последнее число. */
export function monthRange(month: string): DateRange {
  const [year, m] = month.split('-').map(Number);
  return {
    from: toISODate(new Date(year, m - 1, 1)),
    to: toISODate(new Date(year, m, 0)),
  };
}

const MONTHS_FULL = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

export function monthTitle(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTHS_FULL[Number(m) - 1]} ${year}`;
}

export function describeRange(range: DateRange): string {
  if (!range.from) return 'за всё время';
  return `${formatDate(range.from)} — ${formatDate(range.to)}`;
}

export function toISODate(date: Date): ISODate {
  // Не через toISOString: он переводит в UTC и в вечерних часовых поясах сдвигает дату на день назад.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(date: ISODate): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

/** «два месяца назад», «на прошлой неделе» — понятнее, чем дата. */
export function monthsAgo(date: ISODate, today = new Date()): string {
  const days = Math.floor((Date.parse(toISODate(today)) - Date.parse(date)) / 86_400_000);
  if (days < 0) return 'в планах';
  if (days === 0) return 'сегодня';
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  if (days < 31) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${plural(weeks, 'неделю', 'недели', 'недель')} назад`;
  }
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} ${plural(months, 'месяц', 'месяца', 'месяцев')} назад`;
  const years = Math.floor(months / 12);
  return `${years} ${plural(years, 'год', 'года', 'лет')} назад`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
