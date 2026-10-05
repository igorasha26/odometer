import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/app.css', 'utf-8') + readFileSync('src/styles/theme.css', 'utf-8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : walk(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/** Классы, встречающиеся в разметке как обычные строки. */
function usedClasses(): Set<string> {
  const used = new Set<string>();
  for (const file of walk('src')) {
    const text = readFileSync(file, 'utf-8');
    for (const match of text.matchAll(/className="([a-z0-9 -]+)"/g)) {
      match[1].split(/\s+/).filter(Boolean).forEach((c: string) => used.add(c));
    }
  }
  return used;
}

const defined = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]));

describe('стили', () => {
  it('у каждого класса из разметки есть правило', () => {
    // Стили уже терялись при переписывании медиазапросов — тогда переключатель
    // машины остался голой кнопкой браузера. Эта проверка ловит такое сразу.
    const missing = [...usedClasses()].filter((c) => !defined.has(c));
    expect(missing).toEqual([]);
  });

  it('контейнеры раскладки умеют сжиматься', () => {
    // Без min-width: 0 элемент flex/grid не сжимается меньше содержимого,
    // и внутренняя прокрутка распирает всю страницу.
    for (const selector of ['.main', '.page-actions', '.dash-cell', '.card-fill']) {
      expect(css).toContain(selector);
    }
    expect(css).toMatch(/\.main[\s\S]{0,400}min-width: 0/);
  });

  it('всплывающие панели не шире экрана', () => {
    // Календарь и панель периода имели фиксированную ширину и вылезали за край.
    // Только собственная ширина: max-width и границы медиазапросов не в счёт.
    const fixed = [...css.matchAll(/(?<![-a-z])width:\s*(\d{3,})px/g)].map((m) => Number(m[1]));
    expect(fixed.filter((value) => value > 320)).toEqual([]);
  });

  it('элементы управления на телефоне не мельче сорока пикселей', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobile).toMatch(/\.btn\s*\{[^}]*min-height:\s*44px/);
    expect(mobile).toMatch(/\.icon-btn\s*\{[^}]*width:\s*40px/);
  });

  it('ленты с прокруткой не растягивают страницу', () => {
    // Сегменты периода и столбцы графика шире экрана по своей природе:
    // без собственной прокрутки они распирают всю раскладку.
    expect(css).toMatch(/\.seg\s*\{[^}]*overflow-x: auto/);
    expect(css).toMatch(/\.bars-row\s*\{[^}]*overflow-x: auto/);
    expect(css).toMatch(/\.main\s*\{[^}]*overflow-x: hidden/);
  });

  it('в мобильном режиме сайдбар становится нижней панелью', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobile).toMatch(/\.shell[^{]*\{[^}]*grid-template-columns: 1fr/);
    expect(mobile).toMatch(/\.sidebar\s*\{[^}]*position: fixed/);
  });

  it('переключатель темы занимает всю ширину, а не прокручивается', () => {
    // Раньше «Системная» уходила за край карточки на телефоне.
    expect(css).toMatch(/\.seg-fill\s*\{[^}]*width: 100%/);
    expect(css).toMatch(/\.seg-fill \.seg-opt\s*\{[^}]*flex: 1 1 0/);
  });

  it('поля ввода на телефоне не меньше 16 пикселей — иначе iOS зумит при фокусе', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobile).toMatch(/\.input[^{]*\{[^}]*font-size: var\(--text-body\)/);
  });
});

describe('переключатель темы', () => {
  it('раскладывается долями, а не прокруткой', () => {
    // Выбор из трёх: все варианты должны быть видны сразу.
    expect(css).toMatch(/\.theme-switch\s*\{[^}]*grid-template-columns: repeat\(3/);
    expect(css).toMatch(/\.theme-switch\s*\{[^}]*overflow: visible/);
  });

  it('на узком экране оставляет иконки без подписей', () => {
    const narrow = css.slice(css.indexOf('@media (max-width: 560px)'));
    expect(narrow).toMatch(/\.theme-switch \.seg-opt span\s*\{[^}]*display: none/);
  });
});
