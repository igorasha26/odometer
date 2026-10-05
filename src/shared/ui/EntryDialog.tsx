import { useEffect, useState } from 'react';
import { repository } from '../../repository';
import { DOCUMENT_KIND, PART_KINDS } from '../../entities/categories';
import { FUEL_LABELS, type Car, type Category, type Entry, type FuelType, type NewEntry } from '../../entities/types';
import { Modal } from './Modal';
import { DatePicker } from './DatePicker';
import { Select } from './Select';
import { CategoryIcon } from './icons';
import { rublesToMoney } from '../lib/money';
import { completeFuelFields } from '../lib/fuel';
import { toISODate } from '../lib/stats';
import { validateEntry } from '../lib/validation';

interface Props {
  car: Car;
  categories: Category[];
  entry?: Entry;
  onClose: () => void;
  onSaved: () => void;
}

const numberInput = (value: string) => value.replace(',', '.');

type FuelField = 'liters' | 'price' | 'amount';
const FUEL_FIELDS: FuelField[] = ['liters', 'price', 'amount'];

const FUEL_OPTIONS = (Object.entries(FUEL_LABELS) as [FuelType, string][])
  .map(([value, label]) => ({ value, label }));

const DOCUMENT_PRESETS = ['Полис ОСАГО', 'Полис КАСКО', 'Диагностическая карта', 'Транспортный налог'];

/** 60 вместо 60.00, но 81.5 сохраняем как есть. */
function formatInputMoney(value: number): string {
  const rubles = value / 100;
  return Number.isInteger(rubles) ? String(rubles) : rubles.toFixed(2);
}

export function EntryDialog({ car, categories, entry, onClose, onSaved }: Props) {
  const visible = categories.filter((c) => !c.isHidden);
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? visible[0]?.id ?? '');
  const [date, setDate] = useState(entry?.date ?? toISODate(new Date()));
  const [odometer, setOdometer] = useState(entry ? String(entry.odometer) : '');
  const [lastOdometer, setLastOdometer] = useState<number>();
  const [amount, setAmount] = useState(entry ? formatInputMoney(entry.amount) : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [liters, setLiters] = useState(entry?.fuel ? String(entry.fuel.liters) : '');
  const [pricePerLiter, setPricePerLiter] = useState(
    entry?.fuel ? formatInputMoney(entry.fuel.pricePerLiter) : '',
  );
  const [isFullTank, setFullTank] = useState(entry?.fuel?.isFullTank ?? false);
  const [fuelType, setFuelType] = useState<FuelType>(entry?.fuel?.fuelType ?? car.fuelType);
  const [station, setStation] = useState(entry?.fuel?.station ?? '');
  const [partName, setPartName] = useState(entry?.part?.partName ?? '');
  const [documentTitle, setDocumentTitle] = useState(entry?.part?.partName ?? '');
  const [documentUntil, setDocumentUntil] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return toISODate(date);
  });
  const [trackDocument, setTrackDocument] = useState(true);
  const [vendor, setVendor] = useState(entry?.part?.vendor ?? '');
  const [touched, setTouched] = useState<FuelField[]>(
    entry?.fuel ? ['liters', 'price'] : [],
  );
  const [issues, setIssues] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const isFuel = category?.kind === 'fuel';
  const isPart = category ? PART_KINDS.includes(category.kind) : false;
  // Пробег нужен только на ТО: от него считается следующее обслуживание.
  // В остальных случаях человек его не помнит, и требовать точную цифру бессмысленно.
  const odometerRequired = category?.kind === 'service';
  const isDocument = category?.kind === DOCUMENT_KIND;
  // Ремонт — такие же работы, как ТО, только внеплановые: спрашиваем «что делали»,
  // а не «какую запчасть купили».
  const isWork = category?.kind === 'service' || category?.kind === 'repair';

  // Последний пробег — подсказка в placeholder и значение по умолчанию при сохранении.
  useEffect(() => {
    repository.entries.lastOdometer(car.id).then((last) => setLastOdometer(last));
  }, [car.id]);

  /**
   * Литры, цена за литр и сумма связаны формулой. Пересчитываем то поле,
   * которое пользователь трогал раньше остальных: два последних ввода — то,
   * что он реально знает, третье выводится. Пустое поле всегда считается устаревшим.
   */
  function syncFuel(changed: FuelField, rawValue: string) {
    const values: Record<FuelField, string> = {
      liters: changed === 'liters' ? rawValue : liters,
      price: changed === 'price' ? rawValue : pricePerLiter,
      amount: changed === 'amount' ? rawValue : amount,
    };
    const num = (v: string) => Number(numberInput(v)) || 0;

    // История ручных правок: последнее изменение впереди.
    const manual = [changed, ...touched.filter((f) => f !== changed)];
    setTouched(manual);

    if (FUEL_FIELDS.filter((f) => num(values[f]) > 0).length < 2) return;

    // Поля, которых пользователь не касался, идут в хвост: их значение вычислено,
    // а значит перезаписать его безопаснее всего.
    const order = [...manual, ...FUEL_FIELDS.filter((f) => !manual.includes(f))];
    const empty = FUEL_FIELDS.find((f) => f !== changed && num(values[f]) === 0);
    const target = empty ?? order[order.length - 1];
    if (target === changed) return;

    if (FUEL_FIELDS.filter((f) => f !== target).some((f) => num(values[f]) === 0)) return;

    const completed = completeFuelFields({
      liters: target === 'liters' ? undefined : num(values.liters) || undefined,
      pricePerLiter: target === 'price' ? undefined : rublesToMoney(values.price) || undefined,
      amount: target === 'amount' ? undefined : rublesToMoney(values.amount) || undefined,
    });

    if (target === 'amount' && completed.amount) setAmount(formatInputMoney(completed.amount));
    if (target === 'price' && completed.pricePerLiter) setPricePerLiter(formatInputMoney(completed.pricePerLiter));
    if (target === 'liters' && completed.liters) setLiters(String(completed.liters));
  }

  async function save() {
    const draft: NewEntry = {
      carId: car.id,
      categoryId,
      date,
      odometer: odometer ? Number(odometer) : (lastOdometer ?? car.initialOdometer),
      odometerAuto: odometer ? undefined : true,
      amount: rublesToMoney(amount),
      note: note.trim() || undefined,
      fuel: isFuel
        ? {
            liters: Number(numberInput(liters)) || 0,
            pricePerLiter: rublesToMoney(pricePerLiter),
            isFullTank,
            fuelType,
            station: station.trim() || undefined,
          }
        : undefined,
      part: isPart && partName.trim()
        ? { partName: partName.trim(), vendor: vendor.trim() || undefined }
        : isDocument && documentTitle.trim()
          ? { partName: documentTitle.trim() }
          : undefined,
    };

    const existing = (await repository.entries.list({ carId: car.id }))
      .filter((e) => e.id !== entry?.id);
    const found = validateEntry(draft, existing);
    const errors = found.filter((i) => i.level === 'error');
    if (errors.length) {
      setIssues(errors.map((e) => e.message));
      return;
    }
    const warnings = found.filter((i) => i.level === 'warning');
    if (warnings.length && !confirmed) {
      setIssues(warnings.map((w) => w.message));
      setConfirmed(true);
      return;
    }

    setSaving(true);
    if (entry) {
      await repository.entries.update(entry.id, draft);
    } else {
      const created = await repository.entries.create(draft);

      // Оплаченный документ сразу попадает в раздел сроков — иначе про него забудут.
      if (isDocument && trackDocument && documentTitle.trim()) {
        await repository.reminders.create({
          carId: car.id,
          title: documentTitle.trim(),
          dueDate: documentUntil,
          intervalMonths: 12,
          completedEntryId: created.id,
        });
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={entry ? 'Изменить расход' : 'Новый расход'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {confirmed && issues.length ? 'Всё равно сохранить' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Категория</label>
        <div className="cat-grid">
          {visible.map((c) => (
            <button
              key={c.id}
              type="button"
              className="cat-tile"
              aria-pressed={c.id === categoryId}
              onClick={() => { setCategoryId(c.id); setIssues([]); setConfirmed(false); }}
            >
              <CategoryIcon kind={c.kind} name={c.name} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label>Дата</label>
          <DatePicker value={date} onChange={setDate} label="Дата" />
        </div>
        <div className="field">
          <label>Пробег, км {odometerRequired ? '' : '· необязательно'}</label>
          <input
            className="input num" inputMode="numeric" value={odometer}
            placeholder={String(lastOdometer ?? car.initialOdometer)}
            onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ''))}
          />
          <div className="hint">
            {odometerRequired
              ? 'На ТО пробег важен: от него считается следующее обслуживание.'
              : 'Оставьте пустым — подставим последний известный.'}
          </div>
        </div>

        {isFuel && (
          <>
            <div className="field">
              <label>Объём, л</label>
              <input
                className="input num" inputMode="decimal" value={liters}
                onChange={(e) => { setLiters(e.target.value); syncFuel('liters', e.target.value); }}
              />
            </div>
            <div className="field">
              <label>Цена за литр, ₽</label>
              <input
                className="input num" inputMode="decimal" value={pricePerLiter}
                onChange={(e) => { setPricePerLiter(e.target.value); syncFuel('price', e.target.value); }}
              />
            </div>
            <div className="field">
              <label>Марка топлива</label>
              <Select
                label="Марка топлива"
                value={fuelType}
                onChange={setFuelType}
                options={FUEL_OPTIONS}
              />
            </div>
            <div className="field">
              <label>АЗС</label>
              <input className="input" value={station} onChange={(e) => setStation(e.target.value)} placeholder="Лукойл" />
            </div>
          </>
        )}

        {isDocument && (
          <>
            <div className="field span-2">
              <label>Какой документ</label>
              <input
                className="input" value={documentTitle} placeholder="Полис ОСАГО"
                onChange={(e) => setDocumentTitle(e.target.value)}
              />
              <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
                {DOCUMENT_PRESETS.map((preset) => (
                  <button key={preset} type="button" className="chip" onClick={() => setDocumentTitle(preset)}>
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="field span-2">
              <label>Действует до</label>
              <DatePicker value={documentUntil} onChange={setDocumentUntil} label="Действует до" />
            </div>
          </>
        )}

        {isPart && (
          <>
            <div className="field span-2">
              <label>{isWork ? 'Какие работы делали' : 'Какую запчасть купили'}</label>
              <input
                className="input" value={partName}
                placeholder={isWork ? 'Замена масла и фильтров' : 'Тормозные колодки, передние'}
                onChange={(e) => setPartName(e.target.value)}
              />
            </div>
            <div className="field span-2">
              <label>{isWork ? 'Где делали' : 'Где купили'}</label>
              <input
                className="input" value={vendor}
                placeholder={isWork ? 'Название сервиса' : 'Магазин или маркетплейс'}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="field">
          <label>Сумма, ₽</label>
          <input
            className="input num" inputMode="decimal" value={amount}
            onChange={(e) => { setAmount(e.target.value); if (isFuel) syncFuel('amount', e.target.value); }}
          />
        </div>
        <div className="field">
          <label>Заметка</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {isDocument && documentTitle.trim() && (
        <label className="switch-row">
          <span>
            Следить за сроком
            <span className="hint" style={{ display: 'block' }}>
              Документ появится в разделе «Документы» с обратным отсчётом до конца срока.
            </span>
          </span>
          <input
            type="checkbox" className="switch" role="switch"
            checked={trackDocument} onChange={(e) => setTrackDocument(e.target.checked)}
          />
        </label>
      )}

      {isFuel && (
        <label className="switch-row">
          <span>
            Заправил до полного бака
            <span className="hint" style={{ display: 'block' }}>
              Необязательно: расход считается и без этого, отметка лишь уточняет расчёт.
            </span>
          </span>
          <input
            type="checkbox" className="switch" role="switch"
            checked={isFullTank} onChange={(e) => setFullTank(e.target.checked)}
          />
        </label>
      )}

      {issues.length > 0 && (
        <div className={`notice${confirmed ? '' : ' notice-danger'}`}>
          {issues.map((text) => <div key={text}>{text}</div>)}
          {confirmed && <div className="text-muted" style={{ marginTop: 4 }}>Нажмите «Всё равно сохранить», если так и было.</div>}
        </div>
      )}
    </Modal>
  );
}
