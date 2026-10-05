import { useEffect, useRef, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { DatePicker } from './DatePicker';
import {
  PERIOD_LABELS, PERIOD_PRESETS, type DateRange, type PeriodPreset,
  describeRange, periodRange, toISODate,
} from '../lib/stats';

interface Props {
  preset: PeriodPreset;
  range: DateRange;
  onChange: (preset: PeriodPreset, range: DateRange) => void;
  name: string;
}

export function PeriodPicker({ preset, range, onChange, name }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from ?? toISODate(new Date()));
  const [to, setTo] = useState(range.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function apply() {
    // Перепутанные границы — обычная опечатка, разворачиваем молча.
    const [start, end] = from <= to ? [from, to] : [to, from];
    onChange('custom', { from: start, to: end });
    setOpen(false);
  }

  return (
    <div className="period-picker" ref={ref}>
      <div className="seg">
        {PERIOD_PRESETS.map((key) => (
          <label key={key} className="seg-opt">
            <input
              type="radio"
              name={name}
              checked={preset === key}
              onChange={() => onChange(key, periodRange(key))}
            />
            {PERIOD_LABELS[key]}
          </label>
        ))}
      </div>

      <button
        type="button"
        className={preset === 'custom' ? 'chip period-custom' : 'chip'}
        aria-pressed={preset === 'custom'}
        onClick={() => setOpen((v) => !v)}
        title="Свой период"
      >
        <CalendarRange size={15} aria-hidden />
        <span className="period-custom-label">
          {preset === 'custom' ? describeRange(range) : 'Свой период'}
        </span>
      </button>

      {open && (
        <div className="period-panel">
          <div className="field">
            <label>С какого дня</label>
            <DatePicker value={from} onChange={setFrom} label="Начало периода" />
          </div>
          <div className="field">
            <label>По какой день</label>
            <DatePicker value={to} onChange={setTo} label="Конец периода" />
          </div>
          <div className="period-panel-foot">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn btn-primary" onClick={apply}>Показать</button>
          </div>
        </div>
      )}
    </div>
  );
}
