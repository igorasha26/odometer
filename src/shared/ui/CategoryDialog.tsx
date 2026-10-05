import { useState } from 'react';
import { repository } from '../../repository';
import { KIND_LABELS } from '../../entities/categories';
import type { Category, CategoryKind } from '../../entities/types';
import { Modal } from './Modal';
import { Select } from './Select';
import { CategoryIcon } from './icons';

/** Системные цвета Apple. */
const PALETTE = [
  '#0a84ff', '#5e5ce6', '#af52de', '#ff375f',
  '#ff453a', '#ff9f0a', '#30d158', '#40cbe0',
];

const KIND_OPTIONS = (Object.entries(KIND_LABELS) as [CategoryKind, string][])
  .map(([value, label]) => ({ value, label }));

export function CategoryDialog({
  category, onClose, onSaved,
}: {
  category?: Category; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'other');
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    if (category) await repository.categories.update(category.id, { name: name.trim(), kind, color });
    else {
      const all = await repository.categories.list(true);
      await repository.categories.create({
        name: name.trim(),
        kind,
        color,
        isHidden: false,
        sortOrder: Math.max(0, ...all.map((c) => c.sortOrder)) + 10,
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={category ? 'Изменить категорию' : 'Новая категория'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>Сохранить</button>
        </>
      }
    >
      <div className="field">
        <label>Название</label>
        <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Парковка у офиса" />
      </div>

      <div className="field">
        <label>Тип</label>
        <Select label="Тип" value={kind} onChange={setKind} options={KIND_OPTIONS} />
        <div className="hint">
          Тип задаёт иконку и поля в форме: у «Топлива» появятся литры, у «Запчастей» — название детали.
        </div>
      </div>

      <div className="field">
        <label>Цвет</label>
        <div className="chips">
          {PALETTE.map((value) => (
            <button
              key={value}
              type="button"
              className="icon-btn"
              onClick={() => setColor(value)}
              style={{
                background: value,
                width: 28, height: 28,
                borderRadius: '50%',
                outline: color === value ? '2px solid var(--text)' : 'none',
                outlineOffset: 2,
              }}
              aria-label={`Цвет ${value}`}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <label>Предпросмотр</label>
        <div className="entry-row">
          <div className="entry-icon"><CategoryIcon kind={kind} name={name} /></div>
          <div className="entry-body"><div className="entry-title">{name || 'Название категории'}</div></div>
        </div>
      </div>
    </Modal>
  );
}
