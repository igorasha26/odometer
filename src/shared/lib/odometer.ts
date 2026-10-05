import { repository } from '../../repository';
import type { Car, Entry } from '../../entities/types';

/**
 * Пересчёт автоматически подставленных пробегов.
 *
 * Пробег, который человек не вводил, — это догадка «столько же, сколько было в прошлый раз».
 * Если пробег машины поправили (частая история: ошиблись на порядок при добавлении),
 * все такие догадки становятся неверными, и их нужно пересобрать заново:
 * каждая запись наследует последнюю известную отметку на свою дату.
 */
export function recalculateAutoOdometers(car: Car, entries: Entry[]): { id: string; odometer: number }[] {
  const ordered = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );

  const updates: { id: string; odometer: number }[] = [];
  let known = car.initialOdometer;

  for (const entry of ordered) {
    if (entry.odometerAuto) {
      if (entry.odometer !== known) updates.push({ id: entry.id, odometer: known });
    } else {
      known = Math.max(known, entry.odometer);
    }
  }

  return updates;
}

export async function applyAutoOdometers(car: Car): Promise<number> {
  const entries = await repository.entries.list({ carId: car.id });
  const updates = recalculateAutoOdometers(car, entries);
  for (const update of updates) {
    await repository.entries.update(update.id, { odometer: update.odometer });
  }
  return updates.length;
}

/** Текущий пробег: наибольшая из достоверных отметок. */
export function currentOdometer(car: Car, entries: Entry[]): number {
  const manual = entries.filter((e) => !e.odometerAuto).map((e) => e.odometer);
  return Math.max(car.initialOdometer, ...manual);
}

/**
 * Установка текущего пробега машины из гаража.
 *
 * Текущий пробег — наибольшая достоверная отметка, поэтому просто поменять
 * `initialOdometer` мало: если в записях есть введённый вручную пробег больше нового,
 * он продолжит определять «сейчас». Такие отметки при явном исправлении считаются
 * ошибочными (обычно вся история внесена с промахом на порядок) и понижаются
 * вместе с автоматическими.
 */
export async function setCurrentOdometer(car: Car, value: number): Promise<{ corrected: number }> {
  const updated = await repository.cars.update(car.id, { initialOdometer: value });
  const entries = await repository.entries.list({ carId: car.id });

  let corrected = 0;
  for (const entry of entries) {
    if (!entry.odometerAuto && entry.odometer > value) {
      await repository.entries.update(entry.id, { odometer: value, odometerAuto: true });
      corrected += 1;
    }
  }

  await applyAutoOdometers(updated);
  return { corrected };
}

/** Сколько записей потеряют свой пробег при понижении — чтобы предупредить заранее. */
export function conflictingEntries(entries: Entry[], value: number): Entry[] {
  return entries.filter((e) => !e.odometerAuto && e.odometer > value);
}
