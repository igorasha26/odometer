import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  id?: string;
}

/**
 * Свой список вместо нативного <select>: браузер рисует его опции средствами ОС,
 * поэтому ни шрифт, ни цвета, ни скругления там не наши.
 */
export function Select<T extends string>({ value, options, onChange, label, id }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const ref = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const controlId = id ?? generatedId;

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActive(index);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) choose(active); else setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown'
        ? Math.min(active + 1, options.length - 1)
        : Math.max(active - 1, 0);
      setActive(next);
      if (!open) choose(next);
    }
  }

  return (
    <div className="select" ref={ref}>
      <button
        type="button"
        id={controlId}
        className="select-control"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span>{current?.label ?? '—'}</span>
        <ChevronDown className="select-chevron" size={16} aria-hidden />
      </button>

      {open && (
        <ul className="select-menu" role="listbox" aria-labelledby={controlId}>
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="select-option"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
