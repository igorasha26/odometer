import { useState } from 'react';
import { formatMoneyShort } from '../lib/money';
import type { MonthlyPoint } from '../lib/stats';

/**
 * Столбцы расходов по месяцам. Свой SVG вместо библиотеки:
 * график простой, а внешний пакет тянет свои шрифты и цвета мимо токенов.
 */
export function MonthlyBars({
  data, height = 160, selected, onSelect,
}: {
  data: MonthlyPoint[];
  height?: number;
  selected?: string;
  onSelect?: (month: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <p className="text-muted">Нет данных за период.</p>;

  const max = Math.max(...data.map((d) => d.total), 1);
  const interactive = Boolean(onSelect);

  return (
    <div className="bars">
      <div className="bars-row" style={{ height }} data-count={data.length}>
        {data.map((point, index) => {
          const ratio = point.total / max;
          const active = hover === index || selected === point.month;
          const dimmed = selected !== undefined && selected !== point.month;

          return (
            <button
              key={point.month}
              type="button"
              className="bars-item"
              disabled={!interactive}
              aria-pressed={selected === point.month}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(point.month)}
              title={interactive ? `Показать ${point.label}` : undefined}
            >
              <span className="bars-value" style={{ opacity: active || data.length <= 8 ? 1 : 0 }}>
                {formatMoneyShort(point.total)}
              </span>
              <span
                className="bars-fill"
                style={{
                  height: `${Math.max(ratio * 100, 2)}%`,
                  background: active ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 55%, transparent)',
                  opacity: dimmed ? 0.4 : 1,
                }}
              />
              <span className="bars-label">{point.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Кольцевая диаграмма структуры расходов.
 * Сегменты разделены зазором, поэтому границы категорий видны даже у соседних
 * по тону цветов; при наведении сегмент выдвигается и в центре появляется его сумма.
 */
export function DonutChart({
  segments, total, size = 168, thickness = 22, hovered, onHover,
}: {
  segments: DonutSegment[];
  total: number;
  size?: number;
  thickness?: number;
  hovered?: string;
  onHover?: (id: string | undefined) => void;
}) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  if (sum === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const GAP = 3; // зазор между сегментами в единицах длины дуги

  const active = segments.find((s) => s.id === hovered);
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flex: 'none', overflow: 'visible' }}
      onMouseLeave={() => onHover?.(undefined)}
    >
      <g className="donut-ring" transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((segment) => {
          const length = (segment.value / sum) * circumference;
          const isActive = segment.id === hovered;
          const isDimmed = hovered !== undefined && !isActive;
          const arc = Math.max(length - GAP, 1);

          const circle = (
            <circle
              key={segment.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={isActive ? thickness + 6 : thickness}
              strokeLinecap="butt"
              strokeDasharray={`${arc} ${circumference - arc}`}
              strokeDashoffset={-offset}
              opacity={isDimmed ? 0.35 : 1}
              style={{ transition: 'stroke-width 160ms ease, opacity 160ms ease', cursor: 'pointer' }}
              onMouseEnter={() => onHover?.(segment.id)}
            />
          );
          offset += length;
          return circle;
        })}
      </g>

      <text
        x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
        fill="var(--text)" fontSize="18" fontWeight="600" fontFamily="var(--font)"
      >
        {formatMoneyShort(active ? active.value : total)}
      </text>
      <text
        x="50%" y="60%" textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font)"
      >
        {active ? active.label : `${segments.length} ${pluralCategories(segments.length)}`}
      </text>
    </svg>
  );
}

function pluralCategories(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'категория';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'категории';
  return 'категорий';
}

/**
 * Линия динамики расхода.
 *
 * Рисуется в фиксированном viewBox с сохранением пропорций: при
 * preserveAspectRatio="none" линию растягивало по горизонтали, и одинаковые
 * по толщине штрихи превращались в разные — отсюда рваный вид.
 * Точки соединяются монотонной кубической кривой: она проходит ровно через
 * значения и не даёт выбросов между ними, в отличие от обычного сплайна.
 */
export function LineChart({
  points, formatValue, referenceValue, referenceLabel,
}: {
  points: { x: string; y: number }[];
  formatValue?: (value: number) => string;
  referenceValue?: number;
  referenceLabel?: string;
}) {
  if (points.length < 2) {
    return <p className="text-muted" style={{ fontSize: 'var(--text-footnote)' }}>Нужно минимум две точки.</p>;
  }

  // Узкий экран получает более «квадратный» viewBox: при сохранении пропорций
  // широкая картинка на телефоне сжималась бы в полоску высотой в сантиметр.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 700;
  const W = narrow ? 380 : 640;
  const H = narrow ? 200 : 220;
  const PAD = narrow
    ? { top: 14, right: 10, bottom: 26, left: 42 }
    : { top: 16, right: 16, bottom: 28, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = points.map((p) => p.y);
  const candidates = referenceValue !== undefined ? [...values, referenceValue] : values;
  const rawMin = Math.min(...candidates);
  const rawMax = Math.max(...candidates);
  // Небольшой запас сверху и снизу, чтобы линия не липла к краям.
  const pad = (rawMax - rawMin) * 0.15 || Math.max(rawMax * 0.1, 1);
  const min = rawMin - pad;
  const max = rawMax + pad;

  const toX = (index: number) => PAD.left + (index / (points.length - 1)) * plotW;
  const toY = (value: number) => PAD.top + plotH - ((value - min) / (max - min)) * plotH;

  const coords = points.map((point, index) => ({ x: toX(index), y: toY(point.y) }));
  const line = monotonePath(coords);
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${PAD.top + plotH} L${coords[0].x.toFixed(1)},${PAD.top + plotH} Z`;

  const ticks = [max - pad, (max + min) / 2, min + pad];
  const format = formatValue ?? ((v: number) => v.toFixed(1));
  const labelStep = Math.ceil(points.length / (narrow ? 4 : 6));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label="Динамика расхода топлива"
    >
      <defs>
        <linearGradient id="line-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left} x2={W - PAD.right} y1={toY(tick)} y2={toY(tick)}
            stroke="var(--separator)" strokeWidth="1"
          />
          <text
            x={PAD.left - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle"
            fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font)"
          >
            {format(tick)}
          </text>
        </g>
      ))}

      {referenceValue !== undefined && (
        <g>
          <line
            x1={PAD.left} x2={W - PAD.right} y1={toY(referenceValue)} y2={toY(referenceValue)}
            stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4 4"
          />
          {referenceLabel && (
            <text
              x={W - PAD.right} y={toY(referenceValue) - 6} textAnchor="end"
              fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font)"
            >
              {referenceLabel}
            </text>
          )}
        </g>
      )}

      <path d={area} fill="url(#line-fade)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {coords.map((c, index) => (
        <circle
          key={index} cx={c.x} cy={c.y} r="3.5"
          fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="2"
        />
      ))}

      {points.map((point, index) => (
        index % labelStep === 0 || index === points.length - 1 ? (
          <text
            key={point.x + index}
            x={toX(index)} y={H - 8} textAnchor="middle"
            fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font)"
          >
            {shortDate(point.x)}
          </text>
        ) : null
      ))}
    </svg>
  );
}

/** Монотонная кубическая интерполяция: кривая не выходит за пределы соседних значений. */
function monotonePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';

  const slopes: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    slopes.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x));
  }

  const tangents: number[] = [slopes[0]];
  for (let i = 1; i < points.length - 1; i++) {
    // На перегибе касательная обнуляется — так кривая не «выстреливает» за точки.
    tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
  }
  tangents.push(slopes[slopes.length - 1]);

  let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = (points[i + 1].x - points[i].x) / 3;
    const c1x = points[i].x + dx;
    const c1y = points[i].y + tangents[i] * dx;
    const c2x = points[i + 1].x - dx;
    const c2y = points[i + 1].y - tangents[i + 1] * dx;
    path += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${points[i + 1].x.toFixed(1)},${points[i + 1].y.toFixed(1)}`;
  }
  return path;
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}
