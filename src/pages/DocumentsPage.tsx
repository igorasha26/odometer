import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { repository } from '../repository';
import { useStore } from '../app/store';
import { useAsync } from '../app/useAsync';
import { DocumentDialog } from '../shared/ui/DocumentDialog';
import { ConfirmDialog } from '../shared/ui/Modal';
import { CarSwitch } from '../shared/ui/CarSwitch';
import { formatDate, toISODate } from '../shared/lib/stats';
import type { Reminder } from '../entities/types';

const SOON_DAYS = 30;

export function DocumentsPage() {
  const { activeCar, categories, loading: storeLoading, revision, refresh } = useStore();
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  const [removing, setRemoving] = useState<Reminder | null>(null);

  const { data: documents, loading } = useAsync(
    async () => (activeCar ? repository.reminders.list(activeCar.id) : []),
    [activeCar?.id, revision],
  );

  if (storeLoading || loading) return <p className="text-muted">Загрузка…</p>;
  if (!activeCar) {
    return (
      <div className="empty">
        <h4>Сначала добавьте автомобиль</h4>
        <Link className="btn btn-primary" to="/cars">Перейти в гараж</Link>
      </div>
    );
  }

  const today = toISODate(new Date());

  const rows = (documents ?? [])
    .map((document) => {
      const days = document.dueDate
        ? Math.round((Date.parse(document.dueDate) - Date.parse(today)) / 86_400_000)
        : undefined;
      return { document, days };
    })
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));

  /** Продление: новая дата отсчитывается от прежней, иначе за годы набегает сдвиг. */
  async function renew(document: Reminder) {
    if (!document.dueDate || !document.intervalMonths) return;
    const next = new Date(document.dueDate);
    next.setMonth(next.getMonth() + document.intervalMonths);
    await repository.reminders.update(document.id, { dueDate: toISODate(next) });
    refresh();
  }

  async function remove(document: Reminder) {
    await repository.reminders.remove(document.id);
    refresh();
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="page-kicker text-muted">Сроки</div>
          <h2>Документы</h2>
          <div style={{ marginTop: 'var(--sp-2)' }}><CarSwitch /></div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={15} /> Добавить документ
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="empty">
          <h4>Документов пока нет</h4>
          <p className="text-muted">
            Полис ОСАГО, КАСКО, диагностическая карта. Внесите дату окончания — приложение покажет,
            сколько до неё осталось, чтобы срок не прошёл незамеченным.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Добавить документ</button>
        </div>
      ) : (
        <section className="card">
          {rows.map(({ document, days }) => (
            <div key={document.id} className="entry-row">
              <div className="entry-body">
                <div className="entry-title">{document.title}</div>
                <div className="entry-meta">
                  {document.dueDate ? `действует до ${formatDate(document.dueDate)}` : 'без срока'}
                  {document.intervalMonths ? ` · продление каждые ${document.intervalMonths} мес.` : ''}
                </div>
              </div>

              <span className={`badge ${
                days === undefined ? '' : days < 0 ? 'badge-danger' : days <= SOON_DAYS ? 'badge-warn' : 'badge-ok'
              }`}>
                {days === undefined
                  ? 'без срока'
                  : days < 0
                    ? `просрочен на ${Math.abs(days)} дн.`
                    : days === 0
                      ? 'истекает сегодня'
                      : `${days} дн.`}
              </span>

              <div className="row-actions">
                {document.intervalMonths && (
                  <button className="icon-btn" onClick={() => renew(document)} aria-label="Продлить">
                    <RefreshCw />
                  </button>
                )}
                <button className="icon-btn" onClick={() => setEditing(document)} aria-label="Изменить"><Pencil /></button>
                <button className="icon-btn" onClick={() => setRemoving(document)} aria-label="Удалить"><Trash2 /></button>
              </div>
            </div>
          ))}
        </section>
      )}

      {editing && (
        <DocumentDialog
          car={activeCar}
          categories={categories}
          document={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Удалить документ?"
          message={removing.title}
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
