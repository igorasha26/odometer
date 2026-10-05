import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '../DatePicker';
import { SortableGrid, sortItems, type GridItem } from '../SortableGrid';

describe('календарь', () => {
  it('показывает дату по-русски и открывается по клику', () => {
    render(<DatePicker value="2026-09-08" onChange={() => {}} />);

    expect(screen.getByText('8 сентября 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Сентябрь 2026')).toBeTruthy();
  });

  it('начинает неделю с понедельника', () => {
    render(<DatePicker value="2026-09-08" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));

    const weekdays = document.querySelectorAll('.calendar-weekdays span');
    expect(weekdays[0].textContent).toBe('Пн');
    expect(weekdays[6].textContent).toBe('Вс');
  });

  it('отдаёт выбранный день в формате ISO', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-09-08" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));

    const day15 = [...document.querySelectorAll('.calendar-day')]
      .find((el) => el.textContent === '15' && el.getAttribute('data-outside') === 'false')!;
    fireEvent.click(day15);

    expect(onChange).toHaveBeenCalledWith('2026-09-15');
  });

  it('листает месяцы', () => {
    render(<DatePicker value="2026-09-08" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));

    fireEvent.click(screen.getByLabelText('Предыдущий месяц'));
    expect(screen.getByText('Август 2026')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Следующий месяц'));
    fireEvent.click(screen.getByLabelText('Следующий месяц'));
    expect(screen.getByText('Октябрь 2026')).toBeTruthy();
  });

  it('переходит через границу года', () => {
    render(<DatePicker value="2026-01-15" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByLabelText('Предыдущий месяц'));
    expect(screen.getByText('Декабрь 2025')).toBeTruthy();
  });
});

describe('порядок блоков', () => {
  const items: GridItem[] = [
    { id: 'a', span: 1, node: <div>А</div> },
    { id: 'b', span: 1, node: <div>Б</div> },
    { id: 'c', span: 2, node: <div>В</div> },
  ];

  it('следует сохранённому порядку', () => {
    expect(sortItems(items, ['c', 'a', 'b']).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('новые блоки уходят в конец, а исчезнувшие отбрасываются', () => {
    expect(sortItems(items, ['b', 'удалённый']).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('без сохранённого порядка оставляет исходный', () => {
    expect(sortItems(items, []).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('стрелка перемещает блок и отдаёт новый порядок', () => {
    const onReorder = vi.fn();
    render(<SortableGrid items={items} order={[]} editing onReorder={onReorder} />);

    // У первого блока стрелка «выше» недоступна, двигаем его «ниже»
    fireEvent.click(screen.getAllByLabelText('Переместить ниже')[0]);
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('в обычном режиме ручек нет', () => {
    render(<SortableGrid items={items} order={[]} editing={false} onReorder={() => {}} />);
    expect(screen.queryByLabelText('Переместить ниже')).toBeNull();
  });
});
