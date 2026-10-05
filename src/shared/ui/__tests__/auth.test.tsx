import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from '../AuthScreen';
import { db, resetSeedCache, seedIfEmpty } from '../../../repository/db';
import { repository } from '../../../repository';
import { createSalt, hashPassword } from '../../lib/auth';

beforeEach(async () => {
  await Promise.all([db.users.clear(), db.settings.clear(), db.categories.clear()]);
  resetSeedCache();
  await seedIfEmpty();
});

const field = (label: string) =>
  screen.getByText((_, el) => el?.tagName === 'LABEL' && el.textContent?.startsWith(label) === true)
    .parentElement!.querySelector('input') as HTMLInputElement;

async function makeUser(email: string, password: string) {
  const salt = createSalt();
  return repository.users.create({
    email, salt, passwordHash: await hashPassword(password, salt),
  });
}

describe('регистрация', () => {
  it('создаёт профиль и запоминает вход', async () => {
    const onDone = vi.fn();
    render(<AuthScreen hasUsers={false} onDone={onDone} />);

    fireEvent.change(field('Почта'), { target: { value: 'Igor@Mail.RU' } });
    fireEvent.change(field('Пароль'), { target: { value: 'parol1234' } });
    fireEvent.change(field('Повторите пароль'), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getByText('Создать профиль'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const user = await repository.users.findByEmail('igor@mail.ru');
    expect(user).toBeTruthy();
    // Пароль в открытом виде не хранится
    expect(JSON.stringify(user)).not.toContain('parol1234');

    const settings = await repository.settings.get();
    expect(settings.currentUserId).toBe(user!.id);
  });

  it('не пропускает несовпадающие пароли', async () => {
    const onDone = vi.fn();
    render(<AuthScreen hasUsers={false} onDone={onDone} />);

    fireEvent.change(field('Почта'), { target: { value: 'igor@mail.ru' } });
    fireEvent.change(field('Пароль'), { target: { value: 'parol1234' } });
    fireEvent.change(field('Повторите пароль'), { target: { value: 'parol12345' } });
    fireEvent.click(screen.getByText('Создать профиль'));

    expect(await screen.findByText('Пароли не совпадают')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('не пропускает слабый пароль', async () => {
    render(<AuthScreen hasUsers={false} onDone={() => {}} />);

    fireEvent.change(field('Почта'), { target: { value: 'igor@mail.ru' } });
    fireEvent.change(field('Пароль'), { target: { value: 'korotky' } });
    fireEvent.change(field('Повторите пароль'), { target: { value: 'korotky' } });
    fireEvent.click(screen.getByText('Создать профиль'));

    expect(await screen.findByText('Не короче восьми символов')).toBeTruthy();
  });

  it('не даёт занять чужую почту', async () => {
    await makeUser('igor@mail.ru', 'parol1234');
    render(<AuthScreen hasUsers onDone={() => {}} />);

    fireEvent.click(screen.getByText('Создать новый профиль'));
    fireEvent.change(field('Почта'), { target: { value: 'igor@mail.ru' } });
    fireEvent.change(field('Пароль'), { target: { value: 'parol1234' } });
    fireEvent.change(field('Повторите пароль'), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getByText('Создать профиль'));

    expect(await screen.findByText(/уже занята/)).toBeTruthy();
  });
});

describe('вход', () => {
  it('пускает с верным паролем', async () => {
    const user = await makeUser('igor@mail.ru', 'parol1234');
    const onDone = vi.fn();
    render(<AuthScreen hasUsers onDone={onDone} />);

    fireEvent.change(field('Почта'), { target: { value: 'igor@mail.ru' } });
    fireEvent.change(field('Пароль'), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getByText('Войти'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await repository.settings.get()).currentUserId).toBe(user.id);
  });

  it('не пускает с неверным паролем', async () => {
    await makeUser('igor@mail.ru', 'parol1234');
    const onDone = vi.fn();
    render(<AuthScreen hasUsers onDone={onDone} />);

    fireEvent.change(field('Почта'), { target: { value: 'igor@mail.ru' } });
    fireEvent.change(field('Пароль'), { target: { value: 'wrong1234' } });
    fireEvent.click(screen.getByText('Войти'));

    expect(await screen.findByText('Неверная почта или пароль')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('не подсказывает, зарегистрирована ли почта', async () => {
    await makeUser('igor@mail.ru', 'parol1234');
    render(<AuthScreen hasUsers onDone={() => {}} />);

    fireEvent.change(field('Почта'), { target: { value: 'chuzhoy@mail.ru' } });
    fireEvent.change(field('Пароль'), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getByText('Войти'));

    // Тот же текст, что и при неверном пароле
    expect(await screen.findByText('Неверная почта или пароль')).toBeTruthy();
  });

  it('вход не зависит от регистра почты', async () => {
    await makeUser('igor@mail.ru', 'parol1234');
    const onDone = vi.fn();
    render(<AuthScreen hasUsers onDone={onDone} />);

    fireEvent.change(field('Почта'), { target: { value: 'IGOR@Mail.ru' } });
    fireEvent.change(field('Пароль'), { target: { value: 'parol1234' } });
    fireEvent.click(screen.getByText('Войти'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
