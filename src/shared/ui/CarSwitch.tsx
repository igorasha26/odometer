import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useStore } from '../../app/store';
import { formatKm } from '../lib/money';

/** Выбор активной машины. Когда машина одна, меню не открывается. */
export function CarSwitch({ currentOdometer }: { currentOdometer?: number }) {
  const { cars, activeCar, setActiveCar } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  if (!activeCar) return null;

  const title = `${activeCar.brand} ${activeCar.model}`.trim();
  const meta = [activeCar.plate, currentOdometer ? formatKm(currentOdometer) : null]
    .filter(Boolean)
    .join(' · ');

  if (cars.length < 2) {
    return (
      <div className="car-switch-static">
        <span className="car-switch-title">{title}</span>
        {meta && <span className="car-switch-meta">{meta}</span>}
      </div>
    );
  }

  return (
    <div className="car-switch" ref={ref}>
      <button
        type="button"
        className="car-switch-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="car-switch-lines">
          <span className="car-switch-title">{title}</span>
          {meta && <span className="car-switch-meta">{meta}</span>}
        </span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="car-switch-menu" role="listbox">
          {cars.map((car) => (
            <button
              key={car.id}
              type="button"
              role="option"
              aria-selected={car.id === activeCar.id}
              className="car-switch-option"
              onClick={() => { setActiveCar(car.id); setOpen(false); }}
            >
              <span className="car-switch-lines">
                <span className="car-switch-title">{car.brand} {car.model}</span>
                {car.plate && <span className="car-switch-meta">{car.plate}</span>}
              </span>
              {car.id === activeCar.id && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
