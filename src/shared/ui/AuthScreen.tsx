import { useState } from 'react';
import { Gauge, ShieldAlert } from 'lucide-react';
import { repository } from '../../repository';
import {
  createSalt, hashPassword, normalizeEmail, passwordStrength,
  safeEqual, validateEmail, validatePassword,
} from '../lib/auth';

type Mode = 'signin' | 'signup';

export function AuthScreen({ hasUsers, onDone }: { hasUsers: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>(hasUsers ? 'signin' : 'signup');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';
  const strength = passwordStrength(password);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) { setError(emailCheck.message); return; }

    if (isSignup) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.ok) { setError(passwordCheck.message); return; }
      if (password !== repeat) { setError('Пароли не совпадают'); return; }
    }

    setBusy(true);
    try {
      const existing = await repository.users.findByEmail(email);

      if (isSignup) {
        if (existing) { setError('Такая почта уже занята — войдите'); return; }
        const salt = createSalt();
        const user = await repository.users.create({
          email: normalizeEmail(email),
          name: name.trim() || undefined,
          passwordHash: await hashPassword(password, salt),
          salt,
        });
        await repository.settings.update({ currentUserId: user.id });
      } else {
        // Одинаковый текст на «нет такой почты» и «неверный пароль»:
        // иначе форма подсказывает, какие адреса зарегистрированы.
        if (!existing) { setError('Неверная почта или пароль'); return; }
        const hash = await hashPassword(password, existing.salt);
        if (!safeEqual(hash, existing.passwordHash)) { setError('Неверная почта или пароль'); return; }
        await repository.settings.update({ currentUserId: existing.id });
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <Gauge size={26} />
          <span>Одометр</span>
        </div>
        <h3>{isSignup ? 'Создайте профиль' : 'С возвращением'}</h3>
        <p className="text-muted auth-lead">
          {isSignup
            ? 'Профиль нужен, чтобы разделить машины и историю между людьми на одном устройстве.'
            : 'Введите почту и пароль, которые указывали при создании профиля.'}
        </p>

        <div className="field">
          <label htmlFor="auth-email">Почта</label>
          <input
            id="auth-email" className="input" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
          />
        </div>

        {isSignup && (
          <div className="field">
            <label htmlFor="auth-name">Как к вам обращаться</label>
            <input
              id="auth-name" className="input" value={name} placeholder="Необязательно"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="auth-password">Пароль</label>
          <input
            id="auth-password" className="input" type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          {isSignup && password.length > 0 && (
            <div className="strength">
              <div className="strength-track">
                <div className="strength-fill" data-level={strength.level} />
              </div>
              <span className="hint">{strength.label}</span>
            </div>
          )}
        </div>

        {isSignup && (
          <div className="field">
            <label htmlFor="auth-repeat">Повторите пароль</label>
            <input
              id="auth-repeat" className="input" type="password" autoComplete="new-password"
              value={repeat} onChange={(e) => setRepeat(e.target.value)}
            />
            {repeat.length > 0 && password !== repeat && (
              <div className="hint" style={{ color: 'var(--orange)' }}>Пароли пока не совпадают</div>
            )}
          </div>
        )}

        {error && <div className="notice notice-danger">{error}</div>}

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {isSignup ? 'Создать профиль' : 'Войти'}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(undefined); }}
        >
          {isSignup ? 'У меня уже есть профиль' : 'Создать новый профиль'}
        </button>

        <div className="auth-warning">
          <ShieldAlert size={16} />
          <span>
            Профили разделяют данные, но не защищают их: всё хранится в этом браузере.
            Пароль от почты или банка сюда вводить не нужно.
          </span>
        </div>
      </form>
    </div>
  );
}
