import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { repository } from '../../repository';
import { seedDemoData } from '../../shared/lib/demo';
import { resetWithUser } from './helpers';
import type { User } from '../../entities/types';

let user: User;

beforeEach(async () => {
  user = await resetWithUser();
});

describe('приложение', () => {
  it('на пустой базе предлагает добавить автомобиль', async () => {
    render(<App />);
    expect(await screen.findByText('Начните с автомобиля')).toBeTruthy();
  });

  it('показывает сводку на демо-данных', async () => {
    await seedDemoData(user.id);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Всего за период')).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText('Стоимость км')).toBeTruthy();
    expect(screen.getByText('В среднем в месяц')).toBeTruthy();

    // Топливо — отдельный блок, не главная метрика.
    const card = screen.getByText('Топливо и расход').closest('.card');
    expect(card).toBeTruthy();

    // Само значение расхода: русская локаль с запятой, а не toFixed с точкой.
    const value = screen.getByText('Расход', { selector: '.stat-label' }).nextElementSibling?.textContent ?? '';
    expect(value).toMatch(/^\d+,\d л$/);
  });

  it('переключает период без падения', async () => {
    await seedDemoData(user.id);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Всего за период')).toBeTruthy(), { timeout: 3000 });

    fireEvent.click(screen.getByLabelText?.('Месяц') ?? screen.getByText('Месяц'));
    await waitFor(() => expect(screen.getByText('Всего за период')).toBeTruthy());
  });

  it('открывает форму расхода с плитками категорий', async () => {
    await seedDemoData(user.id);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Добавить расход')).toBeTruthy(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Добавить расход'));
    expect(await screen.findByText('Новый расход')).toBeTruthy();
    expect(screen.getByText('Заправил до полного бака')).toBeTruthy();
  });
});

describe('оформление', () => {
  it('по умолчанию следует за системной темой', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Одометр')).toBeTruthy());
    // jsdom отвечает на prefers-color-scheme отрицательно — значит светлая.
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('запоминает выбранную тему в настройках', async () => {
    await repository.settings.update({ theme: 'dark' });
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });

  it('сворачивает боковое меню и запоминает это', async () => {
    render(<App />);
    const toggle = await screen.findByLabelText('Свернуть меню');

    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByLabelText('Развернуть меню')).toBeTruthy());
    const settings = await repository.settings.get();
    expect(settings.sidebarCollapsed).toBe(true);
  });
});

describe('знакомство', () => {
  it('показывается новому пользователю и не возвращается после закрытия', async () => {
    await repository.settings.update({ onboardingDone: false });
    render(<App />);

    expect(await screen.findByText('Начните с машины')).toBeTruthy();

    fireEvent.click(screen.getByText('Дальше'));
    expect(screen.getByText('Записывайте траты')).toBeTruthy();

    fireEvent.click(screen.getByText('Пропустить'));
    await waitFor(() => expect(screen.queryByText('Записывайте траты')).toBeNull());

    const settings = await repository.settings.get();
    expect(settings.onboardingDone).toBe(true);
  });

  it('не показывается, если пользователь уже знаком', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Одометр')).toBeTruthy());
    expect(screen.queryByText('Начните с машины')).toBeNull();
  });
});
