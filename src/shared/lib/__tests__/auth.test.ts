import { describe, expect, it } from 'vitest';
import {
  createSalt, hashPassword, normalizeEmail, passwordStrength,
  safeEqual, validateEmail, validatePassword,
} from '../auth';

describe('пароли', () => {
  it('один пароль с одной солью даёт один хеш', async () => {
    const salt = createSalt();
    expect(await hashPassword('Passw0rd', salt)).toBe(await hashPassword('Passw0rd', salt));
  });

  it('одинаковые пароли с разной солью дают разные хеши', async () => {
    const a = await hashPassword('Passw0rd', createSalt());
    const b = await hashPassword('Passw0rd', createSalt());
    expect(a).not.toBe(b);
  });

  it('хеш не содержит самого пароля', async () => {
    const hash = await hashPassword('Passw0rd', createSalt());
    expect(hash.toLowerCase()).not.toContain('passw0rd');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('соль каждый раз новая', () => {
    expect(createSalt()).not.toBe(createSalt());
  });
});

describe('сравнение за постоянное время', () => {
  it('совпадающие строки равны', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  it('разные — нет', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('проверка полей', () => {
  it('приводит почту к нижнему регистру и обрезает пробелы', () => {
    expect(normalizeEmail('  Igor@Mail.RU ')).toBe('igor@mail.ru');
  });

  it('ловит опечатки в адресе', () => {
    expect(validateEmail('igor@mail').ok).toBe(false);
    expect(validateEmail('igor mail.ru').ok).toBe(false);
    expect(validateEmail('igor@mail.ru').ok).toBe(true);
  });

  it('требует восемь символов, букву и цифру', () => {
    expect(validatePassword('short1').ok).toBe(false);
    expect(validatePassword('onlyletters').ok).toBe(false);
    expect(validatePassword('12345678').ok).toBe(false);
    expect(validatePassword('parol1234').ok).toBe(true);
  });

  it('оценивает надёжность по длине и составу', () => {
    expect(passwordStrength('short').level).toBe(0);
    expect(passwordStrength('parol1234').level).toBe(1);
    expect(passwordStrength('parol1234567').level).toBe(2);
    expect(passwordStrength('parol1234567!').level).toBe(3);
  });
});
