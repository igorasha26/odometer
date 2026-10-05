import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarDialog } from '../CarDialog';
import { DocumentDialog } from '../DocumentDialog';
import { Select } from '../Select';
import { db, resetSeedCache, seedIfEmpty } from '../../../repository/db';
import { repository } from '../../../repository';
import type { Car, Category } from '../../../entities/types';

const car: Car = {
  id: 'car', brand: 'VW', model: 'Passat', fuelType: 'ai95',
  initialOdometer: 100000, serviceIntervalKm: 15000, isArchived: false, createdAt: '',
};

let categories: Category[] = [];

beforeEach(async () => {
  await Promise.all([db.cars.clear(), db.categories.clear(), db.entries.clear(), db.reminders.clear(), db.settings.clear()]);
  resetSeedCache();
  await seedIfEmpty();
  await db.cars.put(car);
  categories = await repository.categories.list();
});

const field = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('input') as HTMLInputElement;

describe('выпадающий список', () => {
  it('открывается, выбирает значение и закрывается', () => {
    const onChange = vi.fn();
    render(
      <Select
        value="a"
        onChange={onChange}
        options={[{ value: 'a', label: 'Первый' }, { value: 'b', label: 'Второй' }]}
      />,
    );

    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.click(screen.getByText('Второй'));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('листается стрелками', () => {
    const onChange = vi.fn();
    render(
      <Select
        value="a"
        onChange={onChange}
        options={[{ value: 'a', label: 'Первый' }, { value: 'b', label: 'Второй' }]}
      />,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('добавление машины', () => {
  it('показывает, на каком пробеге делать следующее ТО', () => {
    render(<CarDialog onClose={() => {}} onSaved={() => {}} />);

    fireEvent.change(field('Текущий пробег, км'), { target: { value: '80000' } });
    fireEvent.change(field('Интервал ТО, км'), { target: { value: '10000' } });

    expect(screen.getByText(/Следующее ТО на 90 000 км/)).toBeTruthy();
  });

  it('сохраняет машину с интервалом обслуживания', async () => {
    render(<CarDialog onClose={() => {}} onSaved={() => {}} />);

    fireEvent.change(field('Марка'), { target: { value: 'Kia' } });
    fireEvent.change(field('Текущий пробег, км'), { target: { value: '80000' } });
    fireEvent.change(field('Интервал ТО, км'), { target: { value: '10000' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(async () => {
      const cars = await repository.cars.list();
      expect(cars.some((c) => c.brand === 'Kia')).toBe(true);
    });

    const created = (await repository.cars.list()).find((c) => c.brand === 'Kia')!;
    expect(created.serviceIntervalKm).toBe(10000);
  });
});

describe('документы', () => {
  it('сохраняет срок с автопродлением', async () => {
    const onSaved = vi.fn();
    render(<DocumentDialog car={car} categories={categories} onClose={() => {}} onSaved={onSaved} />);

    fireEvent.change(field('Что это'), { target: { value: 'Полис ОСАГО' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const documents = await repository.reminders.list(car.id);
    expect(documents).toHaveLength(1);
    expect(documents[0].title).toBe('Полис ОСАГО');
    expect(documents[0].intervalMonths).toBe(12);
  });

  it('подставляет название по подсказке', async () => {
    render(<DocumentDialog car={car} categories={categories} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByText('Диагностическая карта'));
    expect(field('Что это').value).toBe('Диагностическая карта');
  });
});

describe('связь документов и расходов', () => {
  it('оплата документа попадает в расходы категорией «Документы»', async () => {
    const onSaved = vi.fn();
    render(<DocumentDialog car={car} categories={categories} onClose={() => {}} onSaved={onSaved} />);

    fireEvent.change(field('Что это'), { target: { value: 'Полис ОСАГО' } });
    fireEvent.change(field('Сколько заплатили, ₽'), { target: { value: '14300' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    const entries = await repository.entries.list({ carId: car.id });
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(1430000);

    const documentCategory = categories.find((c) => c.name === 'Документы')!;
    expect(entries[0].categoryId).toBe(documentCategory.id);

    // Документ и запись связаны
    const documents = await repository.reminders.list(car.id);
    expect(documents[0].completedEntryId).toBe(entries[0].id);
  });

  it('без суммы запись не создаётся', async () => {
    const onSaved = vi.fn();
    render(<DocumentDialog car={car} categories={categories} onClose={() => {}} onSaved={onSaved} />);

    fireEvent.change(field('Что это'), { target: { value: 'Диагностическая карта' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await repository.entries.list({ carId: car.id })).toHaveLength(0);
    expect(await repository.reminders.list(car.id)).toHaveLength(1);
  });
});

describe('исправление пробега машины', () => {
  it('меняет текущий пробег и подтягивает записи', async () => {
    // Пробег ввели с ошибкой на порядок, записи унаследовали её
    await db.cars.update(car.id, { initialOdometer: 450000 });
    const [category] = categories;
    await repository.entries.create({
      carId: car.id, categoryId: category.id, date: '2026-09-01',
      odometer: 450000, odometerAuto: true, amount: 100000,
    });

    const wrong = (await repository.cars.get(car.id))!;
    render(<CarDialog car={wrong} onClose={() => {}} onSaved={() => {}} />);

    await waitFor(() => expect(field('Текущий пробег, км').value).toBe('450000'));
    fireEvent.change(field('Текущий пробег, км'), { target: { value: '145600' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(async () => {
      const updated = await repository.cars.get(car.id);
      expect(updated?.initialOdometer).toBe(145600);
    });

    const entries = await repository.entries.list({ carId: car.id });
    expect(entries[0].odometer).toBe(145600);
  });

  it('показывает текущий пробег из записей, а не поле машины', async () => {
    const [category] = categories;
    await repository.entries.create({
      carId: car.id, categoryId: category.id, date: '2026-09-01', odometer: 147200, amount: 100000,
    });

    render(<CarDialog car={car} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(field('Текущий пробег, км').value).toBe('147200'));
  });
});
