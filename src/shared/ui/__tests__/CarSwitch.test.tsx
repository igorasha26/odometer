import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../../../app/store';
import { CarSwitch } from '../CarSwitch';
import { db, resetSeedCache, seedIfEmpty } from '../../../repository/db';
import { repository } from '../../../repository';

beforeEach(async () => {
  await Promise.all([db.cars.clear(), db.categories.clear(), db.settings.clear(), db.users.clear()]);
  resetSeedCache();
  await seedIfEmpty();
});

const addCar = (brand: string, model: string, plate: string) =>
  repository.cars.create({ brand, model, plate, fuelType: 'ai95', initialOdometer: 100000 });

function renderSwitch() {
  return render(
    <StoreProvider>
      <CarSwitch currentOdometer={255000} />
    </StoreProvider>,
  );
}

describe('переключатель машины', () => {
  it('с одной машиной показывает подпись без кнопки', async () => {
    await addCar('Lada', '2115', 'Р891МТ82');
    renderSwitch();

    await waitFor(() => expect(screen.getByText('Lada 2115')).toBeTruthy());
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Р891МТ82/)).toBeTruthy();
  });

  it('с несколькими машинами открывает список и переключает', async () => {
    await addCar('Lada', '2115', 'Р891МТ82');
    await addCar('Volkswagen', 'Passat B7', 'А412ВК77');
    renderSwitch();

    await waitFor(() => expect(screen.getByRole('button')).toBeTruthy());
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);

    // Выбираем не ту машину, что активна сейчас: какая из них первая — зависит
    // от порядка создания и для этой проверки не важно.
    const other = options.find((el) => el.getAttribute('aria-selected') === 'false')!;
    const otherTitle = other.querySelector('.car-switch-title')!.textContent;
    fireEvent.click(other);

    await waitFor(async () => {
      const settings = await repository.settings.get();
      const cars = await repository.cars.list();
      const picked = cars.find((c) => `${c.brand} ${c.model}` === otherTitle)!;
      expect(settings.activeCarId).toBe(picked.id);
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('закрывается по Escape', async () => {
    await addCar('Lada', '2115', 'Р891МТ82');
    await addCar('Volkswagen', 'Passat B7', 'А412ВК77');
    renderSwitch();

    await waitFor(() => expect(screen.getByRole('button')).toBeTruthy());
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });
});
