import type { Category, CategoryKind } from './types';

type SeedCategory = Omit<Category, 'id'>;

/** Системный набор категорий — создаётся при первом запуске. */
export const SYSTEM_CATEGORIES: SeedCategory[] = [
  { name: 'Топливо',        kind: 'fuel',    color: '#0a84ff', isSystem: true, isHidden: false, sortOrder: 10 },
  { name: 'ТО',             kind: 'service', color: '#5e5ce6', isSystem: true, isHidden: false, sortOrder: 20 },
  { name: 'Запчасти',       kind: 'parts',   color: '#30b0c7', isSystem: true, isHidden: false, sortOrder: 30 },
  { name: 'Ремонт',         kind: 'repair',  color: '#ff9f0a', isSystem: true, isHidden: false, sortOrder: 40 },
  { name: 'Мойка',          kind: 'wash',    color: '#40cbe0', isSystem: true, isHidden: false, sortOrder: 60 },
  { name: 'Документы',      kind: 'tax',     color: '#30d158', isSystem: true, isHidden: false, sortOrder: 70 },
  { name: 'Налог',          kind: 'tax',     color: '#af52de', isSystem: true, isHidden: false, sortOrder: 80 },
  { name: 'Штрафы',         kind: 'fine',    color: '#ff453a', isSystem: true, isHidden: false, sortOrder: 90 },
  { name: 'Парковка',       kind: 'other',   color: '#64d2ff', isSystem: true, isHidden: false, sortOrder: 100 },
  { name: 'Аксессуары',     kind: 'other',   color: '#ff375f', isSystem: true, isHidden: false, sortOrder: 110 },
  { name: 'Прочее',         kind: 'other',   color: '#98989d', isSystem: true, isHidden: false, sortOrder: 120 },
];

export const KIND_LABELS: Record<CategoryKind, string> = {
  fuel: 'Топливо',
  service: 'Обслуживание',
  parts: 'Запчасти',
  repair: 'Ремонт',
  wash: 'Мойка',
  tax: 'Налоги и страховка',
  fine: 'Штрафы',
  other: 'Прочее',
};

/** Категория этого типа заводит запись в разделе «Документы». */
export const DOCUMENT_KIND: CategoryKind = 'tax';

/** У этих типов категорий в форме появляется блок с деталями запчасти/работы. */
export const PART_KINDS: CategoryKind[] = ['parts', 'service', 'repair'];
