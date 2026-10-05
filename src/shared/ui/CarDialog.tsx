import { useEffect, useState } from 'react';
import { repository } from '../../repository';
import { FUEL_LABELS, type Car, type Entry, type FuelType, type Transmission } from '../../entities/types';
import { Modal } from './Modal';
import { Select } from './Select';
import { conflictingEntries, currentOdometer, setCurrentOdometer } from '../lib/odometer';

const TRANSMISSIONS: Record<Transmission, string> = {
  auto: 'Автомат',
  manual: 'Механика',
  cvt: 'Вариатор',
  robot: 'Робот',
};

const FUEL_OPTIONS = (Object.entries(FUEL_LABELS) as [FuelType, string][])
  .map(([value, label]) => ({ value, label }));

const TRANSMISSION_OPTIONS = (Object.entries(TRANSMISSIONS) as [Transmission, string][])
  .map(([value, label]) => ({ value, label }));

export function CarDialog({
  car, userId, onClose, onSaved,
}: {
  car?: Car; userId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [brand, setBrand] = useState(car?.brand ?? '');
  const [model, setModel] = useState(car?.model ?? '');
  const [year, setYear] = useState(car?.year ? String(car.year) : '');
  const [engine, setEngine] = useState(car?.engine ?? '');
  const [plate, setPlate] = useState(car?.plate ?? '');
  const [odometer, setOdometer] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string>();
  const [fuelType, setFuelType] = useState<FuelType>(car?.fuelType ?? 'ai95');
  const [transmission, setTransmission] = useState<Transmission>(car?.transmission ?? 'auto');
  const [tankVolume, setTankVolume] = useState(car?.tankVolume ? String(car.tankVolume) : '');
  const [factoryConsumption, setFactory] = useState(car?.factoryConsumption ? String(car.factoryConsumption) : '');
  const [serviceIntervalKm, setInterval] = useState(String(car?.serviceIntervalKm ?? 15000));
  const [saving, setSaving] = useState(false);

  const num = (v: string) => (v ? Number(v.replace(',', '.')) : undefined);

  // При открытии показываем не поле машины, а реальный текущий пробег:
  // он мог уйти вперёд из-за записей с введённым одометром.
  useEffect(() => {
    if (!car) { setOdometer(''); return; }
    repository.entries.list({ carId: car.id }).then((list) => {
      setEntries(list);
      setOdometer(String(currentOdometer(car, list)));
    });
  }, [car]);

  function changeOdometer(value: string) {
    setOdometer(value);
    const next = Number(value);
    const conflicts = value ? conflictingEntries(entries, next) : [];
    setConflictWarning(
      conflicts.length
        ? `В ${conflicts.length} ${conflicts.length === 1 ? 'записи' : 'записях'} указан больший пробег — `
          + 'он будет исправлен на этот.'
        : undefined,
    );
  }

  async function save() {
    if (!brand.trim()) return;
    setSaving(true);
    const payload = {
      brand: brand.trim(),
      model: model.trim(),
      year: num(year),
      engine: engine.trim() || undefined,
      plate: plate.trim() || undefined,
      fuelType,
      transmission,
      tankVolume: num(tankVolume),
      factoryConsumption: num(factoryConsumption),
      serviceIntervalKm: num(serviceIntervalKm),
      initialOdometer: Number(odometer) || 0,
    };

    if (car) {
      const { initialOdometer: nextOdometer, ...rest } = payload;
      await repository.cars.update(car.id, rest);
      // Пробег правят отдельно: он определяется не только полем машины,
      // но и отметками в записях, поэтому их тоже нужно привести в порядок.
      if (nextOdometer !== currentOdometer(car, entries)) {
        await setCurrentOdometer({ ...car, ...rest }, nextOdometer);
      }
    }
    else {
      const created = await repository.cars.create({ ...payload, userId });
      const settings = await repository.settings.get();
      if (!settings.activeCarId) await repository.settings.update({ activeCarId: created.id });

    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={car ? 'Изменить автомобиль' : 'Новый автомобиль'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !brand.trim()}>Сохранить</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label>Марка</label>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} autoFocus placeholder="Volkswagen" />
        </div>
        <div className="field">
          <label>Модель</label>
          <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Passat B7" />
        </div>
        <div className="field">
          <label>Год выпуска</label>
          <input className="input num" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <label>Двигатель</label>
          <input className="input" value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="1.8 TSI" />
        </div>
        <div className="field">
          <label>Текущий пробег, км</label>
          <input
            className="input num" inputMode="numeric" value={odometer}
            onChange={(e) => changeOdometer(e.target.value.replace(/\D/g, ''))}
          />
          {conflictWarning && <div className="hint" style={{ color: 'var(--orange)' }}>{conflictWarning}</div>}
        </div>
        <div className="field">
          <label>Госномер</label>
          <input className="input" value={plate} onChange={(e) => setPlate(e.target.value)} />
        </div>
        <div className="field">
          <label>Топливо</label>
          <Select label="Топливо" value={fuelType} onChange={setFuelType} options={FUEL_OPTIONS} />
        </div>
        <div className="field">
          <label>Коробка передач</label>
          <Select
            label="Коробка передач"
            value={transmission}
            onChange={setTransmission}
            options={TRANSMISSION_OPTIONS}
          />
        </div>
        <div className="field">
          <label>Объём бака, л</label>
          <input className="input num" inputMode="decimal" value={tankVolume} onChange={(e) => setTankVolume(e.target.value)} />
        </div>
        <div className="field">
          <label>Заводской расход, л/100 км</label>
          <input className="input num" inputMode="decimal" value={factoryConsumption} onChange={(e) => setFactory(e.target.value)} />
          <div className="hint">Сравним с фактическим по вашим заправкам</div>
        </div>
        <div className="field">
          <label>Интервал ТО, км</label>
          <input
            className="input num" inputMode="numeric" value={serviceIntervalKm}
            onChange={(e) => setInterval(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="hint span-2">
          {serviceIntervalKm && odometer
            ? `Следующее ТО на ${(Number(odometer) + Number(serviceIntervalKm)).toLocaleString('ru-RU')} км.`
            : 'Укажите пробег и интервал — покажем, на каком пробеге делать следующее ТО.'}
        </div>
      </div>
    </Modal>
  );
}
