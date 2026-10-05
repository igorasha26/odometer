import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { repository } from '../repository';
import { useStore } from '../app/store';
import { useAsync } from '../app/useAsync';
import { CarDialog } from '../shared/ui/CarDialog';
import { ConfirmDialog } from '../shared/ui/Modal';
import { FUEL_LABELS, type Car } from '../entities/types';
import { serviceCycle } from '../shared/lib/service';
import { currentOdometer } from '../shared/lib/odometer';
import { monthsAgo } from '../shared/lib/stats';

interface ServiceInfo {
  lastOdometer?: number;
  nextOdometer?: number;
  agoText: string;
}
import { formatKm, formatMoney } from '../shared/lib/money';

export function CarsPage() {
  const { cars, categories, user, loading, revision, refresh } = useStore();
  const [editing, setEditing] = useState<Car | 'new' | null>(null);
  const [removing, setRemoving] = useState<Car | null>(null);

  // Сводка по каждой машине: расходы, пробег и состояние обслуживания.
  const { data } = useAsync(async () => {
    const totals: Record<string, { total: number; odometer: number; count: number }> = {};
    const serviceInfo: Record<string, ServiceInfo> = {};

    for (const car of cars) {
      const entries = await repository.entries.list({ carId: car.id });
      const odometer = currentOdometer(car, entries);
      totals[car.id] = {
        total: entries.reduce((sum, e) => sum + e.amount, 0),
        odometer,
        count: entries.length,
      };

      const cycle = serviceCycle(car, entries, categories, odometer);
      serviceInfo[car.id] = {
        lastOdometer: cycle.lastOdometer,
        nextOdometer: cycle.nextOdometer,
        agoText: cycle.lastDate ? monthsAgo(cycle.lastDate) : '',
      };
    }
    return { totals, serviceInfo };
  }, [cars.map((c) => c.id).join(','), revision]);

  const totals = data?.totals;
  const serviceInfo = data?.serviceInfo;

  async function remove(car: Car) {
    await repository.cars.remove(car.id);
    refresh();
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="page-kicker text-muted">Гараж</div>
          <h2>Автомобили</h2>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={15} /> Добавить автомобиль
          </button>
        </div>
      </header>

      {loading && <p className="text-muted">Загрузка…</p>}

      {!loading && cars.length === 0 && (
        <div className="empty">
          <h4>В гараже пусто</h4>
          <p className="text-muted">
            Добавьте машину — марка, пробег и заводской расход нужны, чтобы считать топливо и стоимость километра.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Добавить автомобиль</button>
        </div>
      )}

      <div className="grid grid-2">
        {cars.map((car) => {
          const stats = totals?.[car.id];
          const service = serviceInfo?.[car.id];
          return (
            <article key={car.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
                <div>
                  <div className="card-kicker text-muted">
                    {[car.year, car.engine, FUEL_LABELS[car.fuelType]].filter(Boolean).join(' · ')}
                  </div>
                  <div className="card-title">{car.brand} {car.model}</div>
                  <div className="card-meta text-muted">{car.plate ?? 'без номера'}</div>
                </div>
                <div className="row-actions car-actions">
                  <button className="icon-btn" onClick={() => setEditing(car)} aria-label="Изменить"><Pencil /></button>
                  <button className="icon-btn" onClick={() => setRemoving(car)} aria-label="Удалить"><Trash2 /></button>
                </div>
              </div>

              <div className="grid grid-3" style={{ marginTop: 'var(--sp-5)', gap: 'var(--sp-4)' }}>
                <div>
                  <div className="stat-label">Пробег</div>
                  <div style={{ fontSize: 16 }}>{stats ? formatKm(stats.odometer) : '—'}</div>
                </div>
                <div>
                  <div className="stat-label">Расходы</div>
                  <div style={{ fontSize: 16 }}>{stats ? formatMoney(stats.total) : '—'}</div>
                </div>
                <div>
                  <div className="stat-label">Записей</div>
                  <div style={{ fontSize: 16 }}>{stats?.count ?? 0}</div>
                </div>
              </div>

              {service && (
                <div className="car-service">
                  {service.lastOdometer !== undefined ? (
                    <>
                      Последнее ТО {service.agoText} — на {service.lastOdometer.toLocaleString('ru-RU')} км.
                      {service.nextOdometer !== undefined &&
                        ` Следующее на ${service.nextOdometer.toLocaleString('ru-RU')} км.`}
                    </>
                  ) : service.nextOdometer !== undefined ? (
                    <>ТО ещё не отмечали. Следующее на {service.nextOdometer.toLocaleString('ru-RU')} км.</>
                  ) : (
                    <>Интервал ТО не задан.</>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {editing && (
        <CarDialog
          car={editing === 'new' ? undefined : editing}
          userId={user?.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Удалить автомобиль?"
          message={`${removing.brand} ${removing.model} и все его записи будут удалены без возможности восстановить.`}
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
