import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, LayoutGrid, Plus } from 'lucide-react';
import { repository } from '../repository';
import { useStore } from '../app/store';
import { useAsync } from '../app/useAsync';
import { CarSwitch } from '../shared/ui/CarSwitch';
import { BackupNudge } from '../shared/ui/BackupNudge';
import { CategoryIcon } from '../shared/ui/icons';
import { EntryDialog } from '../shared/ui/EntryDialog';
import { SortableGrid, type GridItem } from '../shared/ui/SortableGrid';
import { DonutChart, LineChart, MonthlyBars } from '../shared/ui/charts';
import {
  type DateRange, type PeriodPreset, formatDate, monthRange, monthTitle,
  describeRange, periodRange, summarize, toISODate,
} from '../shared/lib/stats';
import { PeriodPicker } from '../shared/ui/PeriodPicker';
import { calculateFuelStats, METHOD_NOTES } from '../shared/lib/fuel';
import { averageDailyDistance } from '../shared/lib/mileage';
import { currentOdometer } from '../shared/lib/odometer';
import { formatConsumption, formatKm, formatMoney, formatNumber, plural } from '../shared/lib/money';

export function DashboardPage() {
  const { activeCar, categories, settings, loading: storeLoading, revision, refresh } = useStore();
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>(() => periodRange('all'));

  // Клик по столбцу сужает весь обзор до этого месяца.
  const selectedMonth = period === 'custom' && range.from && range.from.endsWith('-01')
    && range.from.slice(0, 7) === range.to.slice(0, 7)
    ? range.from.slice(0, 7)
    : undefined;

  function selectMonth(month: string) {
    if (selectedMonth === month) {
      setPeriod('all');
      setRange(periodRange('all'));
      return;
    }
    setPeriod('custom');
    setRange(monthRange(month));
  }
  const [isEntryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string>();

  async function saveOrder(order: string[]) {
    await repository.settings.update({ dashboardOrder: order });
    refresh();
  }

  // Одна загрузка на машину. Периоды — фильтрация в памяти: записей сотни,
  // а поход в IndexedDB на каждое переключение давал мигание.
  const { data, loading } = useAsync(async () => {
    if (!activeCar) return undefined;
    const [allEntries, reminders] = await Promise.all([
      repository.entries.list({ carId: activeCar.id }),
      repository.reminders.list(activeCar.id),
    ]);
    return { allEntries, reminders };
  }, [activeCar?.id, revision]);

  const { allEntries = [], reminders = [] } = data ?? {};
  // Все производные считаются один раз на изменение данных или периода.
  const inRange = (entry: { date: string }) =>
    (!range.from || entry.date >= range.from) && entry.date <= range.to;

  const periodEntries = useMemo(() => allEntries.filter(inRange), [allEntries, range.from, range.to]);
  const summary = useMemo(() => summarize(periodEntries, categories), [periodEntries, categories]);
  const lifetime = useMemo(() => summarize(allEntries, categories), [allEntries, categories]);

  // График по месяцам всегда за год: нужен фон, на котором виден выбранный месяц.
  const yearSummary = useMemo(() => {
    const year = periodRange('year');
    return summarize(allEntries.filter((e) => e.date >= year.from! && e.date <= year.to), categories);
  }, [allEntries, categories]);

  const fuel = useMemo(() => calculateFuelStats(periodEntries), [periodEntries]);
  const odometerNow = useMemo(() => activeCar ? currentOdometer(activeCar, allEntries) : 0, [activeCar, allEntries]);
  const daily = useMemo(() => averageDailyDistance(allEntries), [allEntries]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));


  if (storeLoading || loading) return <p className="text-muted">Загрузка…</p>;

  if (!activeCar) {
    return (
      <div className="empty">
        <h4>Начните с автомобиля</h4>
        <p className="text-muted">Марка и пробег нужны, чтобы считать расход топлива и стоимость километра.</p>
        <Link className="btn btn-primary" to="/cars">Перейти в гараж</Link>
      </div>
    );
  }


  const today = toISODate(new Date());
  const documents = reminders
    .filter((r) => r.dueDate)
    .map((document) => ({
      document,
      days: Math.round((Date.parse(document.dueDate!) - Date.parse(today)) / 86_400_000),
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  const consumptionPoints = fuel.intervals.map((i) => ({ x: i.date, y: i.consumption }));
  const consumptionDelta = activeCar.factoryConsumption && fuel.consumption
    ? fuel.consumption - activeCar.factoryConsumption
    : null;

  const blocks: GridItem[] = [
    {
      id: 'metrics',
      span: 2,
      node: (
        <div className="grid grid-4" style={{ width: '100%' }}>
          <div className="card stat">
            <div className="stat-label">Всего за период</div>
            <div className="stat-value">{formatMoney(summary.total)}</div>
            <div className="stat-note text-muted">{summary.entriesCount} записей</div>
          </div>
          <div className="card stat">
            <div className="stat-label">В среднем в месяц</div>
            <div className="stat-value">
              {lifetime.byMonth.length
                ? formatMoney(Math.round(lifetime.total / lifetime.byMonth.length))
                : '—'}
            </div>
            <div className="stat-note text-muted">
              за всё время: {lifetime.byMonth.length} {plural(lifetime.byMonth.length, 'месяц', 'месяца', 'месяцев')}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">Стоимость км</div>
            <div className="stat-value">
              {summary.costPerKm !== null ? formatMoney(summary.costPerKm, true) : '—'}
            </div>
            <div className="stat-note text-muted">
              {summary.distance > 0 ? `пробег ${formatKm(summary.distance)}` : 'нужны две записи с разным пробегом'}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">Одометр</div>
            <div className="stat-value">
              {odometerNow.toLocaleString('ru-RU')}
              <span className="stat-unit"> км</span>
            </div>
            <div className="stat-note text-muted">
              {daily ? `${Math.round(daily * 30).toLocaleString('ru-RU')} км в месяц` : 'текущий пробег'}
            </div>
          </div>
        </div>
      ),
    },
  ];

  blocks.push(
    {
      id: 'months',
      span: 2,
      node: (
        <div className="card">
          <div className="section-title">
            <h4>Расходы по месяцам</h4>
            <span className="text-muted" style={{ fontSize: 'var(--text-footnote)' }}>
              {selectedMonth ? monthTitle(selectedMonth) : 'нажмите на столбец, чтобы посмотреть месяц'}
            </span>
          </div>
          <div className="card-fill">
            <MonthlyBars
              data={yearSummary.byMonth}
              height={200}
              selected={selectedMonth}
              onSelect={selectMonth}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'structure',
      span: 1,
      node: (
        <div className="card">
          <div className="section-title"><h4>Структура расходов</h4></div>
          <div className="card-fill donut-layout">
            <DonutChart
              segments={summary.byCategory.slice(0, 6).map((c) => ({
                id: c.categoryId, label: c.name, value: c.total, color: c.color,
              }))}
              total={summary.total}
              hovered={hoveredCategory}
              onHover={setHoveredCategory}
            />
            <div className="donut-legend">
              {summary.byCategory.slice(0, 6).map((row) => (
                <div
                  key={row.categoryId}
                  className="bar-row"
                  data-active={hoveredCategory === row.categoryId}
                  onMouseEnter={() => setHoveredCategory(row.categoryId)}
                  onMouseLeave={() => setHoveredCategory(undefined)}
                >
                  <div className="bar-head">
                    <span><span className="dot" style={{ background: row.color }} /> {row.name}</span>
                    <span>{formatMoney(row.total)}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${row.share}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'recent',
      span: 1,
      node: (
        <div className="card">
          <div className="section-title">
            <h4>Последние записи</h4>
            <Link to="/entries">Вся история</Link>
          </div>
          <div className="card-fill" style={{ justifyContent: 'flex-start' }}>
            {periodEntries.slice(0, 6).map((entry) => {
              const category = categoryById.get(entry.categoryId);
              return (
                <div key={entry.id} className="entry-row">
                  <div className="entry-icon">
                    <CategoryIcon kind={category?.kind ?? 'other'} name={category?.name} />
                  </div>
                  <div className="entry-body">
                    <div className="entry-title">
                      {entry.fuel
                        ? `${category?.name ?? 'Топливо'}, ${entry.fuel.liters} л`
                        : entry.part?.partName ?? entry.note ?? category?.name}
                    </div>
                    <div className="entry-meta">{formatDate(entry.date)} · {formatKm(entry.odometer)}</div>
                  </div>
                  <div className="entry-sum">{formatMoney(entry.amount)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'documents',
      span: 1,
      node: (
        <div className="card">
          <div className="section-title">
            <h4>Документы</h4>
            <Link to="/documents">Все</Link>
          </div>
          <div className="card-fill" style={{ justifyContent: 'flex-start' }}>
            {documents.length === 0 && (
              <p className="text-muted" style={{ margin: 0 }}>
                Сроков не заведено. Внесите ОСАГО или диагностическую карту.
              </p>
            )}
            {documents.map(({ document, days }) => (
              <div key={document.id} className="entry-row">
                <div className="entry-body">
                  <div className="entry-title">{document.title}</div>
                  <div className="entry-meta">
                    {document.dueDate ? `до ${formatDate(document.dueDate)}` : 'без срока'}
                  </div>
                </div>
                <span className={`badge ${days < 0 ? 'badge-danger' : days <= 30 ? 'badge-warn' : 'badge-ok'}`}>
                  {days < 0 ? `просрочен на ${Math.abs(days)} дн.` : `${days} дн.`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  );

  if (fuel.fillUps > 0) {
    blocks.push({
      id: 'fuel',
      span: 2,
      node: (
        <div className="card">
          <div className="section-title">
            <h4>Топливо и расход</h4>
            <span className="text-muted" style={{ fontSize: 'var(--text-footnote)' }}>
              {METHOD_NOTES[fuel.method]}
            </span>
          </div>
          <div className="grid grid-3" style={{ gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <div>
              <div className="stat-label">Расход</div>
              <div className="cycle-value">
                {fuel.consumption !== null ? formatConsumption(fuel.consumption) : '—'}
              </div>
              {consumptionDelta !== null && (
                <div className={`stat-note ${consumptionDelta > 0 ? 'delta-up' : 'delta-down'}`}>
                  {consumptionDelta > 0 ? '+' : ''}{formatNumber(consumptionDelta)} к заводскому
                </div>
              )}
            </div>
            <div>
              <div className="stat-label">Залито</div>
              <div className="cycle-value">{formatNumber(fuel.totalLiters, 0)} л</div>
              <div className="stat-note text-muted">{fuel.fillUps} заправок</div>
            </div>
            <div>
              <div className="stat-label">Средняя цена</div>
              <div className="cycle-value">
                {fuel.averagePricePerLiter !== null ? formatMoney(fuel.averagePricePerLiter, true) : '—'}
              </div>
              <div className="stat-note text-muted">за литр</div>
            </div>
          </div>

          {consumptionPoints.length >= 2 && (
            <LineChart
              points={consumptionPoints}
              formatValue={formatConsumption}
              referenceValue={activeCar.factoryConsumption}
              referenceLabel={activeCar.factoryConsumption ? 'заводской' : undefined}
            />
          )}
          {fuel.method === 'anchors' && (
            <div className="hint" style={{ marginTop: 'var(--sp-4)' }}>
              Считается на отрезке в {formatKm(fuel.trackedDistance)} между записями с указанным пробегом.
              Чем чаще вводите одометр, тем точнее цифра.
            </div>
          )}
          {fuel.method === 'none' && fuel.fillUps > 0 && (
            <div className="hint" style={{ marginTop: 'var(--sp-4)' }}>
              Заправки есть, но пробег в них не указан. Введите одометр хотя бы в двух записях —
              расход посчитается на отрезке между ними.
            </div>
          )}
        </div>
      ),
    });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="page-kicker text-muted">Обзор</div>
          <h2>Расходы на автомобиль</h2>
          <div className="page-subline">
            <CarSwitch currentOdometer={odometerNow} />
            <span className="period-caption">{describeRange(range)}</span>
          </div>
        </div>
        <div className="page-actions">
          <PeriodPicker
            name="dashboard-period"
            preset={period}
            range={range}
            onChange={(nextPreset, nextRange) => { setPeriod(nextPreset); setRange(nextRange); }}
          />
          <button
            className={editing ? 'btn btn-secondary' : 'icon-btn'}
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? 'Готово' : 'Изменить порядок блоков'}
            title={editing ? 'Готово' : 'Изменить порядок блоков'}
          >
            {editing ? <><Check size={15} /> Готово</> : <LayoutGrid />}
          </button>
          <button className="btn btn-primary hide-mobile" onClick={() => setEntryOpen(true)}>
            <Plus size={15} /> Добавить расход
          </button>
        </div>
      </header>

      <BackupNudge />

      {periodEntries.length === 0 ? (
        <div className="empty">
          <h4>За этот период записей нет</h4>
          <p className="text-muted">Внесите заправку или мойку — сводка соберётся сама.</p>
          <button className="btn btn-primary" onClick={() => setEntryOpen(true)}>Добавить расход</button>
        </div>
      ) : (
        <SortableGrid
          items={blocks}
          order={settings?.dashboardOrder ?? []}
          editing={editing}
          onReorder={saveOrder}
        />
      )}

      {isEntryOpen && (
        <EntryDialog
          car={activeCar}
          categories={categories}
          onClose={() => setEntryOpen(false)}
          onSaved={() => { setEntryOpen(false); refresh(); }}
        />
      )}
    </>
  );
}
