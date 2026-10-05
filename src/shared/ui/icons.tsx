import {
  Fuel, Wrench, Cog, Hammer, Droplets, FileText,
  Receipt, TriangleAlert, SquareParking, Package, Ellipsis,
} from 'lucide-react';
import type { CategoryKind } from '../../entities/types';

/** Иконка подбирается по типу категории — пользовательские тоже получают свою. */
const BY_KIND: Record<CategoryKind, typeof Fuel> = {
  fuel: Fuel,
  service: Cog,
  parts: Wrench,
  repair: Hammer,
  wash: Droplets,
  tax: FileText,
  fine: TriangleAlert,
  other: Ellipsis,
};

/** Точные совпадения по названию системных категорий. */
const BY_NAME: Record<string, typeof Fuel> = {
  'Налог': Receipt,
  'Парковка': SquareParking,
  'Аксессуары': Package,
};

export function CategoryIcon({ kind, name, size = 18 }: { kind: CategoryKind; name?: string; size?: number }) {
  const Icon = (name && BY_NAME[name]) || BY_KIND[kind] || Ellipsis;
  return <Icon size={size} strokeWidth={1.75} />;
}
