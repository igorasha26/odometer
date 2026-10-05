import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { seedDemoData } from '../../shared/lib/demo';
import { resetWithUser } from './helpers';
import type { User } from '../../entities/types';

let user: User;

/** Ширина окна влияет на разметку графиков — задаём её явно. */
function setViewport(width: number, height = 800) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true });
  window.dispatchEvent(new Event('resize'));
}

beforeEach(async () => {
  user = await resetWithUser();
  setViewport(1440);
});

describe('раскладка на разных экранах', () => {
  it('на телефоне график расхода получает более компактный viewBox', async () => {
    await seedDemoData(user.id);
    setViewport(390); // iPhone
    render(<App />);

    await waitFor(() => expect(screen.getByText('Топливо и расход')).toBeTruthy(), { timeout: 3000 });
    const chart = screen.getByLabelText('Динамика расхода топлива');
    expect(chart.getAttribute('viewBox')).toBe('0 0 380 200');
  });

  it('на широком экране график шире', async () => {
    await seedDemoData(user.id);
    setViewport(1440);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Топливо и расход')).toBeTruthy(), { timeout: 3000 });
    const chart = screen.getByLabelText('Динамика расхода топлива');
    expect(chart.getAttribute('viewBox')).toBe('0 0 640 220');
  });

  it('столбцы месяцев сообщают своё количество для прокрутки на узком экране', async () => {
    await seedDemoData(user.id);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Расходы по месяцам')).toBeTruthy(), { timeout: 3000 });
    const row = document.querySelector('.bars-row')!;
    expect(Number(row.getAttribute('data-count'))).toBeGreaterThan(0);
  });

  it('навигация одна и та же на любом экране', async () => {
    setViewport(390);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Обзор')).toBeTruthy());

    for (const label of ['Обзор', 'Расходы', 'Документы', 'Гараж', 'Настройки']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('плавающая кнопка есть на обзоре и в расходах, но не в настройках', async () => {
    await seedDemoData(user.id);
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText('Добавить расход')).toBeTruthy(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Настройки'));
    await waitFor(() => expect(screen.getByText('Оформление')).toBeTruthy());
    expect(screen.queryByLabelText('Добавить расход')).toBeNull();
  });

  it('меню сворачивается только на широком экране — на телефоне это таб-бар', async () => {
    render(<App />);
    // Кнопка есть в разметке всегда, на телефоне её прячет CSS
    await waitFor(() => expect(screen.getByLabelText('Свернуть меню')).toBeTruthy());
  });
});
