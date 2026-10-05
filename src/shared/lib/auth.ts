/**
 * Локальные учётные записи.
 *
 * ВАЖНО: это разделение профилей, а не защита данных. Всё лежит в браузере,
 * и кто угодно с доступом к устройству может открыть базу через инструменты
 * разработчика. Пароль хранится не в открытом виде — но пока нет сервера,
 * который проверяет его на своей стороне, это удобство, а не безопасность.
 * Настоящая авторизация появится вместе с бэкендом.
 */

const ITERATIONS = 150_000;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

/** PBKDF2-SHA256: подбор по словарю становится дорогим. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

/** Сравнение за постоянное время: длина и содержимое не утекают по таймингу. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface Validation {
  ok: boolean;
  message?: string;
}

export function validateEmail(email: string): Validation {
  const value = normalizeEmail(email);
  if (!value) return { ok: false, message: 'Укажите почту' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return { ok: false, message: 'Похоже, в адресе опечатка' };
  return { ok: true };
}

export function validatePassword(password: string): Validation {
  if (password.length < 8) return { ok: false, message: 'Не короче восьми символов' };
  if (!/[0-9]/.test(password) || !/[a-zA-Zа-яА-Я]/.test(password)) {
    return { ok: false, message: 'Добавьте хотя бы одну цифру и одну букву' };
  }
  return { ok: true };
}

/** Простая оценка надёжности для подсказки в форме: 0–3. */
export function passwordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (password.length < 8) return { level: 0, label: 'Слишком короткий' };
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[0-9]/.test(password) && /[a-zA-Zа-яА-Я]/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  const labels = ['Простой', 'Нормальный', 'Хороший', 'Надёжный'] as const;
  return { level: Math.min(score, 3) as 0 | 1 | 2 | 3, label: labels[Math.min(score, 3)] };
}
