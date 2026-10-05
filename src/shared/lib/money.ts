import type { Money } from '../../entities/types';

/**
 * Деньги везде хранятся в копейках целым числом.
 * 0.1 + 0.2 !== 0.3 — на сотне записей это вылезет в сводке расхождением,
 * которое пользователь заметит.
 */

export function rublesToMoney(value: number | string): Money {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function moneyToRubles(value: Money): number {
  return value / 100;
}

const formatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const formatterPrecise = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
});

export function formatMoney(value: Money, precise = false): string {
  return (precise ? formatterPrecise : formatter).format(moneyToRubles(value));
}

/** Компактный вид для подписей на графиках: 19,2к ₽ */
export function formatMoneyShort(value: Money): string {
  const rub = moneyToRubles(value);
  if (Math.abs(rub) >= 1000) {
    return `${(rub / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}к ₽`;
  }
  return `${Math.round(rub)} ₽`;
}

export function formatKm(value: number): string {
  return `${value.toLocaleString('ru-RU')} км`;
}

export function formatLiters(value: number): string {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} л`;
}

/** Дробное число в русской локали: 8,9 а не 8.9. */
export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Расход топлива с единицами. */
export function formatConsumption(value: number): string {
  return `${formatNumber(value)} л`;
}

/** Русское склонение: 1 месяц, 2 месяца, 5 месяцев. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
