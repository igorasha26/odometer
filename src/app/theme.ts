import { useEffect, useState } from 'react';
import type { ThemeMode } from '../entities/types';

const QUERY = '(prefers-color-scheme: dark)';

/**
 * Разрешает режим в конкретную тему и держит её в атрибуте на <html>.
 * В режиме «системная» слушаем смену оформления ОС: на macOS и iOS она
 * переключается автоматически по расписанию, и приложение должно следовать за ней.
 */
export function useTheme(mode: ThemeMode = 'system') {
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia === 'function' && matchMedia(QUERY).matches,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    // Цвет системной строки в мобильном браузере должен совпадать с фоном.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#f2f2f7');
  }, [resolved]);

  return resolved;
}
