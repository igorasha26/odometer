import { useState } from 'react';
import { repository } from '../../repository';
import type { Car, Category, Reminder } from '../../entities/types';
import { Modal } from './Modal';
import { DatePicker } from './DatePicker';
import { toISODate } from '../lib/stats';
import { rublesToMoney } from '../lib/money';
import { DOCUMENT_KIND } from '../../entities/categories';

const PRESETS = ['Полис ОСАГО', 'Полис КАСКО', 'Диагностическая карта', 'Транспортный налог', 'Договор аренды места'];

interface Props {
  car: Car;
  categories: Category[];
  document?: Reminder;
  onClose: () => void;
  onSaved: () => void;
}

export function DocumentDialog({ car, categories, document, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(document?.title ?? '');
  const [dueDate, setDueDate] = useState(document?.dueDate ?? defaultDate());
  const [intervalMonths, setIntervalMonths] = useState(String(document?.intervalMonths ?? 12));
  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState(toISODate(new Date()));
  const [saving, setSaving] = useState(false);

  const documentCategory = categories.find((c) => c.kind === DOCUMENT_KIND && !c.isHidden);
  // Оплату записываем только при создании: у существующего документа она уже внесена.
  const canRecordPayment = !document && Boolean(documentCategory);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      carId: car.id,
      title: title.trim(),
      dueDate,
      intervalMonths: intervalMonths ? Number(intervalMonths) : undefined,
    };
    if (document) {
      await repository.reminders.update(document.id, payload);
    } else {
      const created = await repository.reminders.create(payload);

      // Оплата документа — обычный расход: пусть попадёт в статистику
      // и останется связанной с самим документом.
      const paid = rublesToMoney(amount);
      if (canRecordPayment && paid > 0) {
        const entry = await repository.entries.create({
          carId: car.id,
          categoryId: documentCategory!.id,
          date: paidDate,
          odometer: (await repository.entries.lastOdometer(car.id)) ?? car.initialOdometer,
          amount: paid,
          part: { partName: payload.title },
        });
        await repository.reminders.update(created.id, { completedEntryId: entry.id });
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={document ? 'Изменить документ' : 'Новый документ'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !title.trim()}>Сохранить</button>
        </>
      }
    >
      <div className="field">
        <label>Что это</label>
        <input
          className="input" value={title} autoFocus placeholder="Полис ОСАГО"
          onChange={(e) => setTitle(e.target.value)}
        />
        {!document && (
          <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
            {PRESETS.map((preset) => (
              <button key={preset} type="button" className="chip" onClick={() => setTitle(preset)}>
                {preset}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="form-grid">
        <div className="field">
          <label>Действует до</label>
          <DatePicker value={dueDate} onChange={setDueDate} label="Дата окончания" />
        </div>
        <div className="field">
          <label>Продлевается каждые, месяцев</label>
          <input
            className="input num" inputMode="numeric" value={intervalMonths} placeholder="12"
            onChange={(e) => setIntervalMonths(e.target.value.replace(/\D/g, ''))}
          />
          <div className="hint">Оставьте пустым для разового документа.</div>
        </div>
      </div>

      {canRecordPayment && (
        <div className="form-grid">
          <div className="field">
            <label>Сколько заплатили, ₽</label>
            <input
              className="input num" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="hint">Попадёт в расходы категорией «{documentCategory!.name}».</div>
          </div>
          <div className="field">
            <label>Дата оплаты</label>
            <DatePicker value={paidDate} onChange={setPaidDate} label="Дата оплаты" />
          </div>
        </div>
      )}
    </Modal>
  );
}

function defaultDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return toISODate(date);
}
