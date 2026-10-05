import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryDialog } from '../EntryDialog';
import { db, resetSeedCache, seedIfEmpty } from '../../../repository/db';
import { repository } from '../../../repository';
import type { Car, Category } from '../../../entities/types';

const car: Car = {
  id: 'car', brand: 'Lada', model: '2115', fuelType: 'ai92',
  initialOdometer: 450000, isArchived: false, createdAt: '',
};

let categories: Category[] = [];

beforeEach(async () => {
  await Promise.all([db.cars.clear(), db.categories.clear(), db.entries.clear(), db.settings.clear()]);
  resetSeedCache();
  await seedIfEmpty();
  await db.cars.put(car);
  categories = await repository.categories.list();
});

const field = (label: string) =>
  screen.getByText((_, el) => el?.tagName === 'LABEL' && el.textContent?.startsWith(label) === true)
    .parentElement!.querySelector('input') as HTMLInputElement;

describe('форма заправки', () => {
  it('считает сумму из литров и цены', async () => {
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20' } });
    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '50' } });

    expect(field('Сумма, ₽').value).toBe('1000');
  });

  it('считает цену из литров и суммы', async () => {
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20' } });
    fireEvent.change(field('Сумма, ₽'), { target: { value: '1000' } });

    expect(field('Цена за литр, ₽').value).toBe('50');
  });

  it('считает литры из цены и суммы', async () => {
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '50' } });
    fireEvent.change(field('Сумма, ₽'), { target: { value: '1000' } });

    expect(field('Объём, л').value).toBe('20');
  });

  it('пересчитывает сумму, когда пользователь правит цену на заполненной форме', async () => {
    // Ровно случай со скриншота: 20 л по 50 ₽ = 1000 ₽, затем цена меняется на 81
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20' } });
    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '50' } });
    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '81' } });

    expect(field('Сумма, ₽').value).toBe('1620');
  });

  it('правка литров после суммы пересчитывает цену, а не сумму', async () => {
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20' } });
    fireEvent.change(field('Сумма, ₽'), { target: { value: '1000' } });
    fireEvent.change(field('Объём, л'), { target: { value: '25' } });

    expect(field('Сумма, ₽').value).toBe('1000');
    expect(field('Цена за литр, ₽').value).toBe('40');
  });

  it('принимает запятую как десятичный разделитель', async () => {
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20,5' } });
    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '50' } });

    expect(field('Сумма, ₽').value).toBe('1025');
  });

  it('подсказывает последний пробег, но не требует вводить его', async () => {
    await repository.entries.create({
      carId: car.id, categoryId: categories[0].id, date: '2026-09-01', odometer: 451200, amount: 1000,
    });
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);

    const odometer = await waitFor(() => {
      const input = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
      expect(input.placeholder).toBe('451200');
      return input;
    });
    expect(odometer.value).toBe('');
  });

  it('без введённого пробега берёт последний известный', async () => {
    await repository.entries.create({
      carId: car.id, categoryId: categories[0].id, date: '2026-09-01', odometer: 451200, amount: 1000,
    });
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20' } });
    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(async () => {
      const saved = await repository.entries.list({ carId: car.id });
      expect(saved).toHaveLength(2);
    });
    const saved = await repository.entries.list({ carId: car.id });
    expect(saved[0].odometer).toBe(451200);
    // Помечаем как догадку: в расчёте расхода такие отметки опорными не считаются
    expect(saved[0].odometerAuto).toBe(true);
  });

  it('введённый пробег остаётся достоверной отметкой', async () => {
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20' } });
    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '50' } });
    fireEvent.change(field('Пробег, км'), { target: { value: '451500' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(async () => {
      expect((await repository.entries.list({ carId: car.id })).length).toBe(1);
    });
    const saved = await repository.entries.list({ carId: car.id });
    expect(saved[0].odometer).toBe(451500);
    expect(saved[0].odometerAuto).toBeUndefined();
  });

  it('сохраняет заправку без отметки полного бака', async () => {
    const onSaved = vi.fn();
    render(<EntryDialog car={car} categories={categories} onClose={() => {}} onSaved={onSaved} />);
    await waitFor(() => expect(field('Объём, л')).toBeTruthy());

    fireEvent.change(field('Объём, л'), { target: { value: '20' } });
    fireEvent.change(field('Цена за литр, ₽'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = await repository.entries.list({ carId: car.id });
    expect(saved[0].fuel?.isFullTank).toBe(false);
    expect(saved[0].amount).toBe(100000);
  });
});
