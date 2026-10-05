import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ISODate } from '../../entities/types';
import { toISODate } from '../lib/stats';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Родительный падеж: «8 сентября», а не «8 сентябрь». */
const MONTHS_OF = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

interface Props {
  value: ISODate;
  onChange: (value: ISODate) => void;
  label?: string;
  /** Запретить выбор дат после сегодняшней. */
  maxToday?: boolean;
}

/**
 * Свой календарь вместо input[type="date"]: нативный виджет рисует браузер,
 * и в Chrome под Windows он выглядит инородно — своя рамка, свой синий, свои шрифты.
 */
export function DatePicker({ value, onChange, label, maxToday }: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(value));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setCursor(startOfMonth(value)); }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const today = toISODate(new Date());
  const days = useMemo(() => buildMonth(cursor), [cursor]);

  function pick(date: ISODate) {
    onChange(date);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  }

  return (
    <div className="datepicker" ref={ref}>
      <button
        type="button"
        className="select-control"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ?? 'Выбрать дату'}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{formatHuman(value)}</span>
        <CalendarDays size={16} className="select-chevron" aria-hidden />
      </button>

      {open && (
        <div className="calendar" role="dialog" aria-label="Календарь">
          <div className="calendar-head">
            <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
              <ChevronLeft />
            </button>
            <span className="calendar-title">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
              <ChevronRight />
            </button>
          </div>

          <div className="calendar-weekdays">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="calendar-grid">
            {days.map(({ date, inMonth }) => {
              const disabled = maxToday && date > today;
              return (
                <button
                  key={date}
                  type="button"
                  className="calendar-day"
                  data-outside={!inMonth}
                  data-today={date === today}
                  aria-pressed={date === value}
                  disabled={disabled}
                  onClick={() => pick(date)}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="calendar-foot">
            <button type="button" className="btn btn-ghost" onClick={() => pick(today)}>Сегодня</button>
          </div>
        </div>
      )}
    </div>
  );
}

function startOfMonth(iso: ISODate): Date {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

/** Сетка 6×7: неделя начинается с понедельника, как принято в России. */
function buildMonth(cursor: Date): { date: ISODate; inMonth: boolean }[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // getDay(): воскресенье — 0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { date: toISODate(day), inMonth: day.getMonth() === cursor.getMonth() };
  });
}

function formatHuman(iso: ISODate): string {
  if (!iso) return 'Выберите дату';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS_OF[Number(m) - 1]} ${y}`;
}
