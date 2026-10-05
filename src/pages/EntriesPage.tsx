import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { repository } from '../repository';
import { useStore } from '../app/store';
import { useAsync } from '../app/useAsync';
import { EntryDialog } from '../shared/ui/EntryDialog';
import { ConfirmDialog } from '../shared/ui/Modal';
import { CarSwitch } from '../shared/ui/CarSwitch';
import { CategoryIcon } from '../shared/ui/icons';
import { downloadFile, entriesToCSV } from '../shared/lib/csv';
import {
  describeRange, formatDate, periodRange, type DateRange, type PeriodPreset,
} from '../shared/lib/stats';
import { PeriodPicker } from '../shared/ui/PeriodPicker';
import { formatKm, formatMoney } from '../shared/lib/money';
import type { Entry } from '../entities/types';

export function EntriesPage() {
  const { activeCar, categories, loading: storeLoading, revision, refresh } = useStore();
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>(() => periodRange('all'));
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  const [removing, setRemoving] = useState<Entry | null>(null);

  const { data: allEntries, loading } = useAsync(
    async () => (activeCar ? repository.entries.list({ carId: activeCar.id }) : []),
    [activeCar?.id, revision],
  );

  // Период режем в памяти: перезапрос на каждое переключение давал мигание.
  const entries = useMemo(
    () => (allEntries ?? []).filter((e) => (!range.from || e.date >= range.from) && e.date <= range.to),
    [allEntries, range.from, range.to],
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const visible = useMemo(() => {
    let rows = entries;
    if (categoryFilter !== 'all') rows = rows.filter((e) => e.categoryId === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((e) =>
        (e.note ?? '').toLowerCase().includes(q) ||
        (e.part?.partName ?? '').toLowerCase().includes(q) ||
        (e.fuel?.station ?? '').toLowerCase().includes(q) ||
        (categoryById.get(e.categoryId)?.name ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  }, [entries, categoryFilter, search, categoryById]);

  if (storeLoading) return <p className="text-muted">Загрузка…</p>;
  if (!activeCar) {
    return (
      <div className="empty">
        <h4>Сначала добавьте автомобиль</h4>
        <Link className="btn btn-primary" to="/cars">Перейти в гараж</Link>
      </div>
    );
  }

  const total = visible.reduce((sum, e) => sum + e.amount, 0);
  const usedCategories = categories.filter((c) => (entries ?? []).some((e) => e.categoryId === c.id));

  async function remove(entry: Entry) {
    await repository.entries.remove(entry.id);
    refresh();
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="page-kicker text-muted">История</div>
          <h2>Расходы</h2>
          <div className="page-subline">
            <CarSwitch />
            <span className="period-caption">{describeRange(range)}</span>
          </div>
        </div>
        <div className="page-actions">
          <PeriodPicker
            name="entries-period"
            preset={period}
            range={range}
            onChange={(nextPreset, nextRange) => { setPeriod(nextPreset); setRange(nextRange); }}
          />
          <button
            className="btn btn-secondary"
            onClick={() => downloadFile(
              entriesToCSV(visible, categories),
              `odometer-${activeCar.brand}-${new Date().toISOString().slice(0, 10)}.csv`,
              'text/csv',
            )}
            disabled={visible.length === 0}
          >
            <Download size={15} /> CSV
          </button>
          <button className="btn btn-primary hide-mobile" onClick={() => setEditing('new')}>
            <Plus size={15} /> Добавить
          </button>
        </div>
      </header>

      <div className="chips mb-6">
        <button className="chip" aria-pressed={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
          Все
        </button>
        {usedCategories.map((c) => (
          <button key={c.id} className="chip" aria-pressed={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>
            {c.name}
          </button>
        ))}
        <input
          className="input entries-search"
          placeholder="Поиск"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted">Загрузка…</p>
      ) : visible.length === 0 ? (
        <div className="empty">
          <h4>Записей нет</h4>
          <p className="text-muted">
            {entries?.length ? 'Под фильтр ничего не попало.' : 'Первая заправка или мойка — и здесь появится история.'}
          </p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Добавить расход</button>
        </div>
      ) : (
        <section className="card">
          <div className="section-title">
            <h4>{visible.length} записей</h4>
            <span className="text-muted">Итого: {formatMoney(total)}</span>
          </div>

          {visible.map((entry) => {
            const category = categoryById.get(entry.categoryId);
            const description = entry.fuel
              ? `${entry.fuel.liters} л${entry.fuel.isFullTank ? ' · полный бак' : ''}${entry.fuel.station ? ` · ${entry.fuel.station}` : ''}`
              : entry.part?.partName ?? entry.note ?? category?.name ?? '';
            return (
              <div key={entry.id} className="entry-row">
                <div className="entry-icon">
                  <CategoryIcon kind={category?.kind ?? 'other'} name={category?.name} />
                </div>
                <div className="entry-body">
                  <div className="entry-title">{description}</div>
                  <div className="entry-meta">
                    {formatDate(entry.date)} · {category?.name} · {formatKm(entry.odometer)}
                  </div>
                </div>
                <div className="entry-sum">{formatMoney(entry.amount)}</div>
                <div className="row-actions">
                  <button className="icon-btn" onClick={() => setEditing(entry)} aria-label="Изменить"><Pencil /></button>
                  <button className="icon-btn" onClick={() => setRemoving(entry)} aria-label="Удалить"><Trash2 /></button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {editing && (
        <EntryDialog
          car={activeCar}
          categories={categories}
          entry={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Удалить запись?"
          message={`${formatDate(removing.date)} · ${formatMoney(removing.amount)}. Отменить будет нельзя.`}
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
