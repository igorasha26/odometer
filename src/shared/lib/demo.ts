import { repository } from '../../repository';
import { rublesToMoney } from './money';
import { toISODate } from './stats';
import type { CategoryKind, NewEntry } from '../../entities/types';

/**
 * Демо-набор: год эксплуатации одной машины.
 * Нужен, чтобы увидеть, как выглядят графики и сводка, не вводя полсотни записей руками.
 */
export async function seedDemoData(userId?: string): Promise<string> {
  const car = await repository.cars.create({
    userId,
    brand: 'Volkswagen',
    model: 'Passat B7',
    year: 2013,
    engine: '1.8 TSI',
    transmission: 'auto',
    plate: 'А 412 ВК 77',
    fuelType: 'ai95',
    tankVolume: 70,
    factoryConsumption: 7.4,
    serviceIntervalKm: 15000,
    serviceIntervalMonths: 12,
    initialOdometer: 130000,
  });

  const categories = await repository.categories.list(true);
  const byKind = (kind: CategoryKind, name?: string) =>
    categories.find((c) => (name ? c.name === name : c.kind === kind))?.id ?? categories[0].id;

  const today = new Date();
  const daysAgo = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return toISODate(date);
  };

  const entries: NewEntry[] = [];
  let odometer = 130000;

  // Заправка примерно каждые 12 дней, ~520 км на бак, расход около 8,9 л/100.
  for (let i = 30; i >= 0; i--) {
    const days = i * 12;
    odometer = 130000 + (30 - i) * 520;
    const liters = Math.round((520 * 0.089 + (Math.random() * 4 - 2)) * 10) / 10;
    const price = 55 + (30 - i) * 0.12;
    entries.push({
      carId: car.id,
      categoryId: byKind('fuel'),
      date: daysAgo(days),
      odometer,
      amount: rublesToMoney(liters * price),
      fuel: {
        liters,
        pricePerLiter: rublesToMoney(price),
        // В жизни до полного заправляют не каждый раз — оставляем смесь.
        isFullTank: i % 2 === 0,
        fuelType: 'ai95',
        station: i % 3 === 0 ? 'Лукойл' : 'Газпромнефть',
      },
    });
  }

  const extras: Array<[number, CategoryKind, string, number, string?]> = [
    [340, 'service', 'ТО-8: масло, фильтры', 11800],
    [300, 'wash', 'Комплекс: кузов и салон', 1100],
    [255, 'parts', 'Щётки стеклоочистителя', 2400],
    [210, 'repair', 'Замена передних колодок', 9200],
    [180, 'wash', 'Мойка', 900],
    [150, 'tax', 'Полис ОСАГО', 14300, 'Документы'],
    [120, 'parts', 'Зимняя резина, комплект', 38000],
    [95, 'wash', 'Мойка', 950],
    [70, 'service', 'ТО-9: масло, фильтры, диагностика', 12400],
    [45, 'fine', 'Превышение скорости', 750],
    [30, 'repair', 'Замена задних колодок', 8700],
    [12, 'wash', 'Комплекс: кузов и салон', 1100],
  ];

  for (const [days, kind, title, rubles, categoryName] of extras) {
    const approxOdometer = 130000 + Math.round(((365 - days) / 365) * 15600);
    entries.push({
      carId: car.id,
      categoryId: byKind(kind, categoryName),
      date: daysAgo(days),
      odometer: approxOdometer,
      amount: rublesToMoney(rubles),
      part: ['parts', 'service', 'repair'].includes(kind) ? { partName: title } : undefined,
      note: ['parts', 'service', 'repair'].includes(kind) ? undefined : title,
    });
  }

  for (const entry of entries) await repository.entries.create(entry);

  await repository.reminders.create({
    carId: car.id,
    title: 'Полис ОСАГО',
    dueDate: daysAgo(-99),
    intervalMonths: 12,
  });
  await repository.reminders.create({
    carId: car.id,
    title: 'Диагностическая карта',
    dueDate: daysAgo(20),
    intervalMonths: 12,
  });

  await repository.settings.update({ activeCarId: car.id });
  return car.id;
}
