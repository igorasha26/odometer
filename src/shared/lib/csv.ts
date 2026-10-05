import type { Category, Entry } from '../../entities/types';
import { moneyToRubles } from './money';
import { formatDate } from './stats';

/** Экранирование по RFC 4180: кавычки удваиваются, поле берётся в кавычки. */
function escapeCell(value: string | number): string {
  const text = String(value ?? '');
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function entriesToCSV(entries: Entry[], categories: Category[]): string {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const header = ['Дата', 'Категория', 'Описание', 'Пробег', 'Литры', 'Цена за литр', 'Сумма'];

  const rows = entries.map((entry) => [
    formatDate(entry.date),
    categoryById.get(entry.categoryId)?.name ?? '',
    entry.part?.partName ?? entry.fuel?.station ?? entry.note ?? '',
    entry.odometer,
    entry.fuel ? String(entry.fuel.liters).replace('.', ',') : '',
    entry.fuel ? String(moneyToRubles(entry.fuel.pricePerLiter).toFixed(2)).replace('.', ',') : '',
    String(moneyToRubles(entry.amount).toFixed(2)).replace('.', ','),
  ]);

  // Точка с запятой и BOM — иначе Excel с русской локалью свалит всё в один столбец.
  return '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n');
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
